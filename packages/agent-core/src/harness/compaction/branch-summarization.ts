import type { ContextMessage } from '../session/context/context-types';
import type { EntryLike, SessionStoreLike } from '../session/sessionInfo/session-repository';
import type { SummarizeFn } from './compaction';
import {
  computeFileLists,
  createFileOps,
  estimateTokens,
  extractFileOpsFromEntry,
  formatFileOperations,
  serializeConversation,
  type FileOperations,
} from './utils';

export interface BranchSummaryEntryPayload {
  kind: 'branch_summary';
  summary: string;
  readFiles: string[];
  modifiedFiles: string[];
}

export interface BranchSummaryResult {
  summary: string;
  readFiles: string[];
  modifiedFiles: string[];
}

export interface BranchPreparation {
  messages: ContextMessage[];
  totalTokens: number;
  fileOps: FileOperations;
}

export interface CollectEntriesResult {
  entries: EntryLike[];
  commonAncestorId: string | null;
}

export interface GenerateBranchSummaryOptions {
  summarize: SummarizeFn;
  customInstructions?: string;
  reserveTokens?: number;
  contextWindow?: number;
}

const BRANCH_SUMMARY_PREAMBLE = `The user explored a different conversation branch before returning here.

`;

const BRANCH_SUMMARY_PROMPT = `Create a structured summary of this conversation branch for context when returning later.

Use this format:

## Goal

## Constraints & Preferences

## Progress
### Done
### In Progress
### Blocked

## Key Decisions

## Next Steps

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

const entryToMessage = (entry: EntryLike): ContextMessage | null => {
  if (!entry.payload || typeof entry.payload !== 'object') {
    return null;
  }
  const payload = entry.payload as Record<string, unknown>;

  if (entry.type === 'compaction' || entry.type === 'branch_summary') {
    if (typeof payload.summary !== 'string') {
      return null;
    }
    const prefix = entry.type === 'compaction' ? '[历史摘要]' : '[分支摘要]';
    return { role: 'user', content: `${prefix}\n${payload.summary}` };
  }

  if (typeof payload.content !== 'string') {
    return null;
  }
  if (entry.type === 'assistant') {
    return { role: 'assistant', content: payload.content };
  }
  if (entry.type === 'user' || entry.type === 'tool') {
    return { role: 'user', content: payload.content };
  }
  return null;
};

const readFilesFromPayload = (
  fileOps: FileOperations,
  payload: Record<string, unknown>,
): void => {
  if (Array.isArray(payload.readFiles)) {
    for (const file of payload.readFiles) {
      if (typeof file === 'string') {
        fileOps.read.add(file);
      }
    }
  }
  if (Array.isArray(payload.modifiedFiles)) {
    for (const file of payload.modifiedFiles) {
      if (typeof file === 'string') {
        fileOps.edited.add(file);
      }
    }
  }
};

export const collectEntriesForBranchSummary = (
  store: SessionStoreLike,
  sessionId: string,
  oldLeafId: string | null,
  targetId: string,
): CollectEntriesResult => {
  if (!oldLeafId) {
    return { entries: [], commonAncestorId: null };
  }

  const entries = store.getEntries(sessionId, { limit: 100000 });
  const byId = new Map<string, EntryLike>(entries.map((entry) => [entry.id, entry]));
  const oldLeaf = byId.get(oldLeafId);
  if (!oldLeaf) {
    return { entries: [], commonAncestorId: null };
  }

  const oldPath = new Set<string>();
  let current: EntryLike | undefined = oldLeaf;
  while (current) {
    oldPath.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  const targetPath: EntryLike[] = [];
  current = byId.get(targetId);
  while (current) {
    targetPath.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  const commonAncestor =
    targetPath.find((entry) => oldPath.has(entry.id)) ?? null;
  const branchEntries: EntryLike[] = [];
  current = oldLeaf;
  while (current && current.id !== commonAncestor?.id) {
    branchEntries.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return {
    entries: branchEntries,
    commonAncestorId: commonAncestor?.id ?? null,
  };
};

export const prepareBranchEntries = (
  entries: EntryLike[],
  tokenBudget = 0,
): BranchPreparation => {
  const messages: ContextMessage[] = [];
  const fileOps = createFileOps();

  for (const entry of entries) {
    if (
      entry.type === 'compaction' ||
      entry.type === 'branch_summary'
    ) {
      if (entry.payload && typeof entry.payload === 'object') {
        readFilesFromPayload(fileOps, entry.payload as Record<string, unknown>);
      }
    }
    extractFileOpsFromEntry(entry, fileOps);
  }

  let totalTokens = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const message = entryToMessage(entries[index]);
    if (!message) {
      continue;
    }

    const tokens = estimateTokens(message);
    if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
      if (
        entries[index].type === 'compaction' ||
        entries[index].type === 'branch_summary'
      ) {
        if (totalTokens < tokenBudget * 0.9) {
          messages.unshift(message);
          totalTokens += tokens;
        }
      }
      break;
    }

    messages.unshift(message);
    totalTokens += tokens;
  }

  return { messages, totalTokens, fileOps };
};

export const generateBranchSummary = async (
  entries: EntryLike[],
  options: GenerateBranchSummaryOptions,
): Promise<BranchSummaryResult> => {
  const contextWindow = options.contextWindow ?? 8000;
  const reserveTokens = options.reserveTokens ?? Math.floor(0.2 * contextWindow);
  const tokenBudget = Math.max(0, contextWindow - reserveTokens);
  const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget);

  if (messages.length === 0) {
    return { summary: 'No content to summarize', readFiles: [], modifiedFiles: [] };
  }

  const conversationText = serializeConversation(messages);
  const prompt = options.customInstructions
    ? `${BRANCH_SUMMARY_PROMPT}\n\nAdditional focus: ${options.customInstructions}`
    : BRANCH_SUMMARY_PROMPT;
  const text = await options.summarize([
    {
      role: 'system',
      content: `You are a context summarization assistant. Do not continue the conversation; only output the branch summary.`,
    },
    {
      role: 'user',
      content: `<conversation>\n${conversationText}\n</conversation>\n\n${prompt}`,
    },
  ]);

  const { readFiles, modifiedFiles } = computeFileLists(fileOps);
  return {
    summary:
      `${BRANCH_SUMMARY_PREAMBLE}${text?.trim() || 'No summary generated'}` +
      formatFileOperations(readFiles, modifiedFiles),
    readFiles,
    modifiedFiles,
  };
};

export const persistBranchSummaryEntry = (
  sessionId: string,
  result: BranchSummaryResult,
  store: SessionStoreLike,
  options: {
    parentId?: string;
    branchId?: string;
    lane?: string;
    fromId?: string;
  } = {},
): EntryLike => {
  const payload: BranchSummaryEntryPayload = {
    kind: 'branch_summary',
    summary: result.summary,
    readFiles: result.readFiles,
    modifiedFiles: result.modifiedFiles,
  };

  return store.appendEntry(sessionId, {
    parentId: options.parentId,
    type: 'branch_summary',
    payload,
    branchId: options.branchId,
    lane: options.lane,
  });
};

export const branchSummaryEntryToMessage = (entry: EntryLike): ContextMessage | null => {
  if (entry.type !== 'branch_summary') {
    return null;
  }
  const payload = entry.payload as Partial<BranchSummaryEntryPayload> | null;
  if (!payload || typeof payload.summary !== 'string') {
    return null;
  }
  return { role: 'user', content: `[分支摘要]\n${payload.summary}` };
};

