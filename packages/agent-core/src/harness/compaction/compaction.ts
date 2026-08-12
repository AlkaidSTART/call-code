import type { ContextMessage } from '../session/context/context-types';
import type { EntryLike, SessionStoreLike } from '../session/sessionInfo/session-repository';
import {
  computeFileLists,
  createFileOps,
  estimateContextTokens,
  estimateTokens,
  extractFileOpsFromMessage,
  formatFileOperations,
  serializeConversation,
  type FileOperations,
} from './utils';

export interface CompactionSettings {
  enabled: boolean;
  reserveTokens: number;
  keepRecentTokens: number;
  contextWindow?: number;
}

const envContextWindow = Number(process.env.OPENAI_CONTEXT_WINDOW ?? 8000);

export const DEFAULT_CONTEXT_WINDOW =
  Number.isFinite(envContextWindow) && envContextWindow > 0 ? envContextWindow : 8000;

export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  enabled: true,
  reserveTokens: 1600,
  keepRecentTokens: 2000,
  contextWindow: DEFAULT_CONTEXT_WINDOW,
};

export interface MessageLike {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type SummarizeFn = (messages: MessageLike[]) => Promise<string | null | undefined>;

export interface CompactionEntryPayload {
  kind: 'compaction';
  summary: string;
  tokensBefore: number;
  retainedTail: ContextMessage[];
  readFiles: string[];
  modifiedFiles: string[];
}

export interface CompactResult {
  summary: string;
  tokensBefore: number;
  retainedTail: ContextMessage[];
  readFiles: string[];
  modifiedFiles: string[];
}

export interface CutPointResult {
  firstKeptIndex: number;
  turnStartIndex: number;
  isSplitTurn: boolean;
}

export interface CompactionPreparation {
  messagesToSummarize: ContextMessage[];
  turnPrefixMessages: ContextMessage[];
  retainedTail: ContextMessage[];
  isSplitTurn: boolean;
  tokensBefore: number;
  previousSummary?: string;
  fileOps: FileOperations;
  settings: CompactionSettings;
}

export interface GenerateSummaryOptions {
  summarize: SummarizeFn;
  previousSummary?: string;
  customInstructions?: string;
}

const SUMMARY_PREFIX = '[历史摘要]';

export const isSummaryMessage = (message: ContextMessage): boolean =>
  message.role === 'user' && message.content.startsWith(SUMMARY_PREFIX);

export const createSummaryMessage = (summary: string): ContextMessage => ({
  role: 'user',
  content: `${SUMMARY_PREFIX}\n${summary}`,
});

export const readPreviousSummary = (message: ContextMessage): string | undefined => {
  if (!isSummaryMessage(message)) {
    return undefined;
  }
  return message.content.slice(SUMMARY_PREFIX.length + 1);
};

export const shouldCompact = (
  contextTokens: number,
  contextWindow: number,
  settings: CompactionSettings,
): boolean => {
  if (!settings.enabled) {
    return false;
  }
  return contextTokens > contextWindow - settings.reserveTokens;
};

export const findCutPoint = (
  messages: ContextMessage[],
  keepRecentTokens: number,
): CutPointResult => {
  if (messages.length === 0) {
    return { firstKeptIndex: 0, turnStartIndex: -1, isSplitTurn: false };
  }

  let cutIndex = 0;
  let accumulated = 0;
  for (let index = messages.length - 1; index >= 0; index--) {
    accumulated += estimateTokens(messages[index]);
    if (accumulated >= keepRecentTokens) {
      cutIndex = index;
      break;
    }
  }

  if (cutIndex >= messages.length) {
    cutIndex = messages.length - 1;
  }

  const cutMessage = messages[cutIndex];
  if (cutMessage.role === 'user') {
    return { firstKeptIndex: cutIndex, turnStartIndex: -1, isSplitTurn: false };
  }

  const turnStartIndex = findTurnStartIndex(messages, cutIndex);
  return {
    firstKeptIndex: cutIndex,
    turnStartIndex,
    isSplitTurn: turnStartIndex !== -1,
  };
};

const findTurnStartIndex = (messages: ContextMessage[], cutIndex: number): number => {
  for (let index = cutIndex - 1; index >= 0; index--) {
    if (messages[index].role === 'user') {
      return index;
    }
  }
  return -1;
};

export const prepareMessagesToCompact = (
  messages: ContextMessage[],
  settings: CompactionSettings,
): CompactionPreparation | undefined => {
  const previousSummary =
    messages.length > 0 ? readPreviousSummary(messages[0]) : undefined;
  const contentMessages = previousSummary ? messages.slice(1) : messages;
  if (contentMessages.length === 0) {
    return undefined;
  }

  const cutPoint = findCutPoint(contentMessages, settings.keepRecentTokens);
  const historyEnd = cutPoint.isSplitTurn
    ? cutPoint.turnStartIndex
    : cutPoint.firstKeptIndex;
  const messagesToSummarize = contentMessages.slice(0, historyEnd);
  const turnPrefixMessages = cutPoint.isSplitTurn
    ? contentMessages.slice(cutPoint.turnStartIndex, cutPoint.firstKeptIndex)
    : [];
  const retainedTail = contentMessages.slice(cutPoint.firstKeptIndex);

  const fileOps = createFileOps();
  for (const message of messagesToSummarize) {
    extractFileOpsFromMessage(message, fileOps);
  }
  for (const message of turnPrefixMessages) {
    extractFileOpsFromMessage(message, fileOps);
  }

  return {
    messagesToSummarize,
    turnPrefixMessages,
    retainedTail,
    isSplitTurn: cutPoint.isSplitTurn,
    tokensBefore: estimateContextTokens(messages),
    previousSummary,
    fileOps,
    settings,
  };
};

const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Read the conversation and produce a structured summary; do not continue the conversation or answer any questions in it.`;

const SUMMARIZATION_PROMPT = `The conversation block below is a session checkpoint. Create a structured summary that another LLM can use to continue the work.

Use this format:

## Goal

## Constraints & Preferences

## Progress
### Done
### In Progress
### Blocked

## Key Decisions

## Next Steps

## Critical Context

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

const UPDATE_SUMMARIZATION_PROMPT = `The conversation block below contains new messages to incorporate into the existing summary in <previous-summary>.

Rules:
- Preserve all existing information from the previous summary.
- Add new progress, decisions, and context from the new messages.
- Move completed items from In Progress to Done.
- Update Next Steps based on what was accomplished.
- Preserve exact file paths, function names, and error messages.

Use this format:

## Goal

## Constraints & Preferences

## Progress
### Done
### In Progress
### Blocked

## Key Decisions

## Next Steps

## Critical Context

Keep each section concise.`;

const TURN_PREFIX_SUMMARIZATION_PROMPT = `The conversation block is the prefix of a turn that was too large to keep. The suffix is retained.

Summarize the prefix for the retained suffix:

## Original Request

## Early Progress

## Context for Suffix

Be concise and focus on information needed to understand the retained suffix.`;

const summaryPromptText = (
  messages: ContextMessage[],
  previousSummary?: string,
  customInstructions?: string,
): string => {
  const conversationText = serializeConversation(messages);
  const parts = [`<conversation>\n${conversationText}\n</conversation>`];
  if (previousSummary) {
    parts.push(`<previous-summary>\n${previousSummary}\n</previous-summary>`);
  }
  const basePrompt = previousSummary
    ? UPDATE_SUMMARIZATION_PROMPT
    : SUMMARIZATION_PROMPT;
  const prompt = customInstructions
    ? `${basePrompt}\n\nAdditional focus: ${customInstructions}`
    : basePrompt;
  parts.push(prompt);
  return parts.join('\n\n');
};

export const generateSummary = async (
  messages: ContextMessage[],
  options: GenerateSummaryOptions,
): Promise<string> => {
  const text = await options.summarize([
    { role: 'system', content: SUMMARIZATION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: summaryPromptText(
        messages,
        options.previousSummary,
        options.customInstructions,
      ),
    },
  ]);
  return text?.trim() || 'No summary generated';
};

const generateTurnPrefixSummary = async (
  messages: ContextMessage[],
  options: GenerateSummaryOptions,
): Promise<string> => {
  const conversationText = serializeConversation(messages);
  const text = await options.summarize([
    { role: 'system', content: SUMMARIZATION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `<conversation>\n${conversationText}\n</conversation>\n\n${TURN_PREFIX_SUMMARIZATION_PROMPT}`,
    },
  ]);
  return text?.trim() || 'No turn prefix summary generated';
};

export const compact = async (
  preparation: CompactionPreparation,
  options: GenerateSummaryOptions,
): Promise<CompactResult | null> => {
  const {
    messagesToSummarize,
    turnPrefixMessages,
    retainedTail,
    isSplitTurn,
    tokensBefore,
    previousSummary,
    fileOps,
  } = preparation;

  if (messagesToSummarize.length === 0 && turnPrefixMessages.length === 0) {
    return null;
  }

  const { readFiles, modifiedFiles } = computeFileLists(fileOps);
  let summary: string;

  if (isSplitTurn && turnPrefixMessages.length > 0) {
    const historyText =
      messagesToSummarize.length > 0
        ? await generateSummary(messagesToSummarize, {
            summarize: options.summarize,
            previousSummary,
            customInstructions: options.customInstructions,
          })
        : 'No prior history before this turn.';
    const turnPrefixText = await generateTurnPrefixSummary(turnPrefixMessages, {
      summarize: options.summarize,
    });
    summary = `${historyText}\n\nTurn Context\n${turnPrefixText}`;
  } else {
    summary = await generateSummary(messagesToSummarize, {
      summarize: options.summarize,
      previousSummary,
      customInstructions: options.customInstructions,
    });
  }

  summary += formatFileOperations(readFiles, modifiedFiles);

  return {
    summary,
    tokensBefore,
    retainedTail,
    readFiles,
    modifiedFiles,
  };
};

export const persistCompactionEntry = (
  sessionId: string,
  result: CompactResult,
  store: SessionStoreLike,
  options: { branchId?: string; lane?: string } = {},
): EntryLike => {
  const payload: CompactionEntryPayload = {
    kind: 'compaction',
    summary: result.summary,
    tokensBefore: result.tokensBefore,
    retainedTail: result.retainedTail,
    readFiles: result.readFiles,
    modifiedFiles: result.modifiedFiles,
  };

  return store.appendEntry(sessionId, {
    type: 'compaction',
    payload,
    branchId: options.branchId,
    lane: options.lane,
  });
};

export const compactionEntryToMessage = (entry: EntryLike): ContextMessage | null => {
  if (entry.type !== 'compaction') {
    return null;
  }
  const payload = entry.payload as Partial<CompactionEntryPayload> | null;
  if (!payload || typeof payload.summary !== 'string') {
    return null;
  }
  return createSummaryMessage(payload.summary);
};

