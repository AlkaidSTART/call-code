import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/llm', () => ({
  streamLLM: vi.fn(),
}));

import { runLoop } from '@core/loop';
import { streamLLM } from '@core/llm';
import { createTaskState } from '@core/state';
import { SessionStore } from '../packages/session-sqlite/src/index';
import {
  closeSharedSessionStore,
  setSharedSessionStore,
} from '@agent-core/harness/session/sessionInfo/session-repository';

describe('runLoop SQLite 持久化', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore({ dbPath: ':memory:' });
    setSharedSessionStore(store);
  });

  afterEach(() => {
    vi.clearAllMocks();
    closeSharedSessionStore();
  });

  it('开启 persist 后写入 user/assistant/tool 条目和运行记录', async () => {
    vi.mocked(streamLLM)
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'tool_call',
          tool: 'get_environment',
          arguments: {},
          message: 'inspect environment',
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'final',
          tool: null,
          arguments: null,
          message: 'done',
        }),
      );

    const task = createTaskState('task');
    const res = await runLoop(task, {}, { persist: true });

    expect(res).toBe('done');
    expect(store.getEntries(task.id).map((entry) => entry.type)).toEqual([
      'user',
      'assistant',
      'tool',
      'assistant',
    ]);
    expect(store.getRecords(task.id).map((record) => record.type)).toEqual([
      'tool_call',
      'tool_result',
    ]);
    expect(store.getStats(task.id).messageCount).toBe(4);
    expect(store.getSession(task.id)?.metadata).toMatchObject({
      mode: task.mode,
      objective: task.objective,
    });
  });

  it('触发压缩后仍能继续执行当前任务', async () => {
    vi.mocked(streamLLM)
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'tool_call',
          tool: 'get_environment',
          arguments: {},
          message: `inspect environment ${'a'.repeat(200)}`,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'final',
          tool: null,
          arguments: null,
          message: 'done',
        }),
      );
    const summarize = vi.fn(async () => '压缩摘要');

    const task = createTaskState('task');
    const res = await runLoop(task, {}, {
      persist: true,
      sessionStore: store,
      compaction: {
        enabled: true,
        contextWindow: 50,
        reserveTokens: 1,
        keepRecentTokens: 1,
      },
      summarize,
    });

    expect(res).toBe('done');
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(store.getEntries(task.id).some((entry) => entry.type === 'compaction')).toBe(true);
  });
});
