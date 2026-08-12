import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionStore } from '../packages/session-sqlite/src/index';
import type { ContextMessage } from '@agent-core/harness/context/context-types';
import {
  compact,
  createSummaryMessage,
  findCutPoint,
  isSummaryMessage,
  persistCompactionEntry,
  prepareMessagesToCompact,
  readPreviousSummary,
  shouldCompact,
  type CompactionSettings,
  type MessageLike,
} from '@agent-core/harness/compaction/compaction';
import {
  branchSummaryEntryToMessage,
  collectEntriesForBranchSummary,
  generateBranchSummary,
  persistBranchSummaryEntry,
  prepareBranchEntries,
} from '@agent-core/harness/compaction/branch-summarization';
import {
  computeFileLists,
  estimateContextTokens,
  extractFileOpsFromMessage,
} from '@agent-core/harness/compaction/utils';

const settings: CompactionSettings = {
  enabled: true,
  reserveTokens: 100,
  keepRecentTokens: 40,
  contextWindow: 800,
};

const mkMessages = (): ContextMessage[] => [
  { role: 'user', content: 'u1-0123456789' },
  { role: 'assistant', content: `a1-${'x'.repeat(180)}` },
  { role: 'user', content: 'u2-0123456789' },
  { role: 'assistant', content: `a2-${'x'.repeat(180)}` },
];

describe('compaction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('根据阈值启用压缩并按字符估算 token', () => {
    expect(shouldCompact(699, 800, settings)).toBe(false);
    expect(shouldCompact(701, 800, settings)).toBe(true);
    expect(shouldCompact(701, 800, { ...settings, enabled: false })).toBe(false);

    const messages: ContextMessage[] = [
      { role: 'user', content: 'abcd' },
      { role: 'assistant', content: 'e'.repeat(20) },
    ];
    const expected = Math.ceil(4 / 4) + 4 + Math.ceil(20 / 4) + 4 + 2;
    expect(estimateContextTokens(messages)).toBe(expected);
  });

  it('切割点保留最近内容，并在 turn 中间单独摘要前缀', () => {
    const messages = mkMessages();
    const cutPoint = findCutPoint(messages, settings.keepRecentTokens);
    expect(cutPoint.isSplitTurn).toBe(true);

    const prep = prepareMessagesToCompact(messages, settings);
    expect(prep?.isSplitTurn).toBe(true);
    expect(prep?.messagesToSummarize.map((message) => message.content)).toEqual([
      messages[0].content,
      messages[1].content,
    ]);
    expect(prep?.turnPrefixMessages.map((message) => message.content)).toEqual([
      messages[2].content,
    ]);
    expect(prep?.retainedTail.map((message) => message.content)).toEqual([
      messages[3].content,
    ]);
  });

  it('已存在摘要时增量更新，提取文件上下文并持久化', async () => {
    const store = new SessionStore({ dbPath: ':memory:' });
    const session = store.createSession({ id: 's1', cwd: '/tmp/w' });
    let seenPrompt = '';
    const summarize = vi.fn(async (messages: MessageLike[]) => {
      seenPrompt = messages[1]?.content ?? '';
      return '新增摘要';
    });
    const messages: ContextMessage[] = [
      createSummaryMessage('旧摘要'),
      {
        role: 'assistant',
        content: JSON.stringify({
          type: 'tool_call',
          tool: 'read_file',
          arguments: { path: 'packages/agent-core/src/index.ts' },
          message: 'reading index',
        }),
      },
      { role: 'user', content: 'tool result '.repeat(60) },
    ];
    const prep = prepareMessagesToCompact(messages, settings);

    expect(prep?.previousSummary).toBe('旧摘要');
    const result = await compact(prep!, { summarize });

    expect(result?.summary).toContain('新增摘要');
    expect(result?.readFiles).toContain('packages/agent-core/src/index.ts');
    expect(seenPrompt).toContain('<previous-summary>');

    const entry = persistCompactionEntry(session.id, result!, store);
    expect(entry.type).toBe('compaction');
    const payload = entry.payload as { summary: string; retainedTail: ContextMessage[] };
    expect(payload.summary).toContain('新增摘要');
    expect(payload.retainedTail).toEqual(result?.retainedTail);
  });

  it('摘要消息可直接识别和读取', () => {
    const summary = createSummaryMessage('目标摘要');
    expect(isSummaryMessage(summary)).toBe(true);
    expect(readPreviousSummary(summary)).toBe('目标摘要');
  });

  it('文件操作提取区分为读取和修改文件', () => {
    const fileOpsResult = createFileOpsWithMessages();
    expect(fileOpsResult.readFiles).toEqual(['src/read.ts']);
    expect(fileOpsResult.modifiedFiles).toEqual(['src/write.ts']);
  });
});

describe('branch summarization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('收集旧分支条目，生成摘要并持久化成 branch_summary', async () => {
    const store = new SessionStore({ dbPath: ':memory:' });
    store.createSession({ id: 's2', cwd: '/tmp/w' });
    const root = store.appendEntry('s2', {
      id: 'root',
      type: 'user',
      payload: { content: 'root' },
    });
    store.appendEntry('s2', {
      id: 'main-a',
      parentId: root.id,
      type: 'assistant',
      payload: { content: 'main a' },
    });
    store.appendEntry('s2', {
      id: 'branch-b',
      parentId: root.id,
      type: 'assistant',
      payload: { content: 'branch b' },
    });
    store.appendEntry('s2', {
      id: 'main-c',
      parentId: 'main-a',
      type: 'assistant',
      payload: { content: 'main c' },
    });

    const collected = collectEntriesForBranchSummary(
      store,
      's2',
      'branch-b',
      'main-c',
    );
    expect(collected.commonAncestorId).toBe(root.id);
    expect(collected.entries.map((entry) => entry.id)).toEqual(['branch-b']);

    const prep = prepareBranchEntries(collected.entries, 1000);
    expect(prep.messages).toEqual([{ role: 'assistant', content: 'branch b' }]);

    const result = await generateBranchSummary(collected.entries, {
      summarize: vi.fn(async () => '分支探索摘要'),
    });
    expect(result.summary).toContain('分支探索摘要');

    const entry = persistBranchSummaryEntry('s2', result, store, {
      parentId: 'main-c',
    });
    expect(entry.type).toBe('branch_summary');
    expect(branchSummaryEntryToMessage(entry)?.content).toContain('[分支摘要]');
  });
});

const createFileOpsWithMessages = (): { readFiles: string[]; modifiedFiles: string[] } => {
  const fileOps = {
    read: new Set<string>(),
    written: new Set<string>(),
    edited: new Set<string>(),
  };
  extractFileOpsFromMessage(
    {
      role: 'assistant',
      content: JSON.stringify({
        type: 'tool_call',
        tool: 'read_file',
        arguments: { path: 'src/read.ts' },
      }),
    },
    fileOps,
  );
  extractFileOpsFromMessage(
    {
      role: 'assistant',
      content: JSON.stringify({
        type: 'tool_call',
        tool: 'write_file',
        arguments: { path: 'src/write.ts' },
      }),
    },
    fileOps,
  );
  return computeFileLists(fileOps);
};
