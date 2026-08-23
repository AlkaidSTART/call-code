import { afterEach, describe, expect, it } from 'vitest';
import { SessionStore } from '../packages/session-sqlite/src/index';
import {
  deleteMessagesCommand,
  deleteSessionCommand,
  formatSessionEntries,
  formatSessionList,
  sessionCommandUsage,
} from '../source/session-commands';

describe('CLI 会话删除命令', () => {
  const stores: SessionStore[] = [];

  const createStore = () => {
    const store = new SessionStore({ dbPath: ':memory:' });
    stores.push(store);
    return store;
  };

  afterEach(() => {
    for (const store of stores.splice(0)) {
      store.close();
    }
  });

  it('列出会话和会话消息', () => {
    const store = createStore();
    store.createSession({
      cwd: '/tmp/project',
      id: 's-cli',
      metadata: { objective: '修复登录问题' },
    });
    store.appendEntry('s-cli', {
      id: 'e1',
      type: 'user',
      payload: { role: 'user', content: '修复登录问题' },
    });
    store.appendEntry('s-cli', {
      id: 'e2',
      parentId: 'e1',
      type: 'assistant',
      payload: { role: 'assistant', content: '开始排查' },
    });
    store.updateStats('s-cli', {
      messageCount: 2,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    });

    const listText = formatSessionList(store);
    expect(listText).toContain('s-cli');
    expect(listText).toContain('2 条');
    expect(listText).toContain('修复登录问题');

    const entriesText = formatSessionEntries(store, 's-cli');
    expect(entriesText).toContain('e1');
    expect(entriesText).toContain('修复登录问题');
    expect(entriesText).toContain('开始排查');
  });

  it('删除单条消息时连同后续回复一起删除', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's-cli-del' });
    store.appendEntry('s-cli-del', {
      id: 'e1',
      type: 'user',
      payload: { role: 'user', content: 'q' },
    });
    store.appendEntry('s-cli-del', {
      id: 'e2',
      parentId: 'e1',
      type: 'assistant',
      payload: { role: 'assistant', content: 'a' },
    });
    store.appendEntry('s-cli-del', {
      id: 'e3',
      parentId: 'e2',
      type: 'tool',
      payload: { role: 'tool', content: 't' },
    });
    store.updateStats('s-cli-del', {
      messageCount: 3,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    });

    expect(deleteMessagesCommand(store, 's-cli-del', 'e2')).toContain(
      '已删除 2 条消息',
    );
    expect(store.getEntries('s-cli-del').map((entry) => entry.id)).toEqual([
      'e1',
    ]);
    expect(store.getStats('s-cli-del').messageCount).toBe(1);
    expect(deleteMessagesCommand(store, 's-cli-del', 'missing')).toContain(
      '未找到',
    );
  });

  it('删除整个会话', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's-cli-session' });
    store.appendEntry('s-cli-session', {
      id: 'e1',
      type: 'user',
      payload: { role: 'user', content: 'q' },
    });

    expect(deleteSessionCommand(store, 's-cli-session')).toContain('已删除');
    expect(store.listSessions()).toHaveLength(0);
    expect(deleteSessionCommand(store, 'missing')).toContain('未找到');
  });

  it('提供带参数命令的用法提示', () => {
    expect(sessionCommandUsage('session')).toContain('/session <sessionId>');
    expect(sessionCommandUsage('delmsg')).toContain(
      '/delmsg <sessionId> <entryId>',
    );
    expect(sessionCommandUsage('delsession')).toContain(
      '/delsession <sessionId>',
    );
  });
});
