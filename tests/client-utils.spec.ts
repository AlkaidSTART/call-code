import { describe, expect, it } from 'vitest';
import type { WebEntry, WebSession } from '../packages/client/src/types';
import {
  entryRole,
  entryText,
  filterEntries,
  getSessionTitle,
  matchesQuery,
} from '../packages/client/src/utils';

const makeEntry = (overrides: Partial<WebEntry> = {}): WebEntry => ({
  seq: 1,
  id: 'e1',
  parentId: null,
  type: 'assistant',
  role: 'assistant',
  timestamp: '2026-08-05T00:00:00.000Z',
  payload: { content: 'hello' },
  ...overrides,
});

const makeSession = (overrides: Partial<WebSession> = {}): WebSession => ({
  id: 's1',
  createdAt: '2026-08-05T00:00:00.000Z',
  cwd: '/tmp/project',
  parentSessionId: null,
  metadata: {},
  stats: {
    messageCount: 1,
    cachedTokens: 0,
    uncachedTokens: 0,
    totalTokens: 0,
    costTotal: 0,
  },
  entries: [makeEntry()],
  records: [],
  facts: [],
  ...overrides,
});

describe('client utils', () => {
  it('根据 role 或 type 推断条目角色', () => {
    expect(entryRole(makeEntry({ role: 'user', type: 'user' }))).toBe('user');
    expect(entryRole(makeEntry({ role: '', type: 'tool' }))).toBe('tool');
    expect(entryRole(makeEntry({ role: 'unknown' }))).toBe('assistant');
  });

  it('优先读取 text，再读取 payload.content', () => {
    expect(
      entryText(makeEntry({ text: '显式文本', payload: { content: '嵌套文本' } })),
    ).toBe('显式文本');
    expect(entryText(makeEntry({ payload: { content: '嵌套文本' } }))).toBe(
      '嵌套文本',
    );
  });

  it('会话标题按用户消息、objective 和 id 依次回退', () => {
    const userSession = makeSession({
      id: 's1',
      metadata: { objective: '目标文本' },
      entries: [makeEntry({ type: 'user', role: 'user', payload: { content: '用户任务' } })],
    });
    const objectiveSession = makeSession({
      id: 's2',
      metadata: { objective: '目标文本' },
      entries: [],
    });
    const idSession = makeSession({ id: 's3', metadata: {}, entries: [] });

    expect(getSessionTitle(userSession)).toBe('用户任务');
    expect(getSessionTitle(objectiveSession)).toBe('目标文本');
    expect(getSessionTitle(idSession)).toBe('s3');
  });

  it('会话搜索覆盖 id、目录、消息内容和工具名', () => {
    const session = makeSession({
      id: 'demo-session',
      metadata: { mode: 'build' },
      entries: [makeEntry({ tool: 'read_file', payload: { content: '打开仪表盘' } })],
    });

    expect(matchesQuery(session, 'demo')).toBe(true);
    expect(matchesQuery(session, '/tmp')).toBe(true);
    expect(matchesQuery(session, '仪表盘')).toBe(true);
    expect(matchesQuery(session, 'read_file')).toBe(true);
    expect(matchesQuery(session, 'missing')).toBe(false);
  });

  it('按 Filter 过滤条目', () => {
    const entries = [
      makeEntry({ id: 'u1', type: 'user', role: 'user' }),
      makeEntry({ id: 'a1', type: 'assistant', role: 'assistant' }),
      makeEntry({ id: 't1', type: 'tool', role: 'tool' }),
    ];

    expect(filterEntries(entries, 'all')).toHaveLength(3);
    expect(filterEntries(entries, 'user')).toEqual([entries[0]]);
    expect(filterEntries(entries, 'tool')).toEqual([entries[2]]);
    expect(filterEntries(entries, 'system')).toEqual([]);
  });
});
