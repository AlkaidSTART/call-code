import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { SessionStore } from '../packages/session-sqlite/src/index';
import { createTaskState } from '@core/state';
import {
  appendTaskEntry,
  appendTaskRecord,
  closeSharedSessionStore,
  ensureTaskSession,
  loadRecentFeed,
  loadRecentHistory,
  readTaskHistory,
  setSharedSessionStore,
} from '@agent-core/harness/session';

describe('SessionRepository', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore({ dbPath: ':memory:' });
    setSharedSessionStore(store);
  });

  afterEach(() => {
    closeSharedSessionStore();
  });

  it('创建任务会话并写入条目、统计和记录', () => {
    const task = createTaskState('hello', { workspace: '/tmp/w' });

    const session = ensureTaskSession(task);
    expect(session.cwd).toBe('/tmp/w');
    expect(store.getSession(task.id)).toMatchObject({ id: task.id, cwd: '/tmp/w' });

    appendTaskEntry(task, { role: 'user', content: 'hi' });
    appendTaskEntry(task, { role: 'assistant', content: 'yo' });
    appendTaskEntry(task, { role: 'tool', content: '{"path":"/tmp/x"}' });
    appendTaskRecord(task, {
      type: 'tool_call',
      opKind: 'get_environment',
      payload: { tool: 'get_environment' },
    });

    expect(store.getEntries(task.id)).toHaveLength(3);
    expect(store.getStats(task.id).messageCount).toBe(3);
    expect(store.getRecords(task.id)).toHaveLength(1);
  });

  it('读取历史时排除 user 条目，tool 结果按 user 角色返回', () => {
    const task = createTaskState('task');
    ensureTaskSession(task);
    appendTaskEntry(task, { role: 'user', content: 'task input' });
    appendTaskEntry(task, { role: 'assistant', content: 'step' });
    appendTaskEntry(task, { role: 'tool', content: 'tool result' });

    expect(readTaskHistory(task)).toEqual([
      { role: 'assistant', content: 'step' },
      { role: 'user', content: 'tool result' },
    ]);
  });

  it('读取历史时按 limit 返回最近条目', () => {
    const task = createTaskState('task');
    ensureTaskSession(task);
    appendTaskEntry(task, { role: 'user', content: 'task input' });
    appendTaskEntry(task, { role: 'assistant', content: 'a1' });
    appendTaskEntry(task, { role: 'tool', content: 't1' });
    appendTaskEntry(task, { role: 'assistant', content: 'a2' });
    appendTaskEntry(task, { role: 'tool', content: 't2' });

    expect(readTaskHistory(task, { limit: 2 })).toEqual([
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 't2' },
    ]);
  });

  it('活动面板可以读回最近历史和相关页面候选', () => {
    const task = createTaskState('task');
    ensureTaskSession(task);
    appendTaskEntry(task, { role: 'user', content: 'u1' });
    appendTaskEntry(task, { role: 'assistant', content: 'a1' });
    appendTaskEntry(task, { role: 'tool', content: '{"path":"/tmp/page.tsx"}' });

    const history = loadRecentHistory(8);
    expect(history[0].role).toBe('assistant');
    expect(history.map((item) => item.content)).toEqual(['a1', 'u1']);

    const feed = loadRecentFeed(10);
    expect(feed[0].role).toBe('tool');
    expect(feed[0].content).toContain('/tmp/page.tsx');
  });
});
