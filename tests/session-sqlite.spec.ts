import { describe, it, expect, afterEach } from 'vitest';
import { SessionStore, DEFAULT_LANE, DEFAULT_BRANCH } from '../packages/session-sqlite/src/index.ts';

describe('SessionStore', () => {
  const stores: SessionStore[] = [];

  function createStore() {
    const store = new SessionStore({ dbPath: ':memory:' });
    stores.push(store);
    return store;
  }

  afterEach(() => {
    for (const store of stores.splice(0)) {
      store.close();
    }
  });

  it('创建会话并初始化基础数据', () => {
    const store = createStore();
    const session = store.createSession({
      cwd: '/tmp/project',
      id: 's1',
      metadata: { source: 'test' },
    });

    expect(session).toMatchObject({
      id: 's1',
      cwd: '/tmp/project',
      parentSessionId: null,
      metadata: { source: 'test' },
    });
    expect(store.getSession('s1')?.createdAt).toBeTruthy();
    expect(store.listSessions()).toHaveLength(1);
    expect(store.getStats('s1')).toMatchObject({ sessionId: 's1', messageCount: 0 });
    expect(store.getLane('s1', DEFAULT_LANE)).toMatchObject({ lane: DEFAULT_LANE, leafId: null });
  });

  it('追加条目会维护命名空间、泳道和分支指针', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's2' });

    const [first, second] = store.transaction(() => [
      store.appendEntry('s2', {
        id: 'e1',
        type: 'user',
        payload: { text: 'hello' },
      }),
      store.appendEntry('s2', {
        id: 'e2',
        parentId: 'e1',
        type: 'assistant',
        payload: { text: 'world' },
        branchId: 'feature',
      }),
    ]);

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(second.parentId).toBe('e1');
    expect(store.getEntries('s2')).toHaveLength(2);
    expect(store.getLane('s2', DEFAULT_LANE)?.leafId).toBe('e2');
    expect(store.listBranchTips('s2').map((tip) => tip.branchId).sort()).toEqual([
      'feature',
      DEFAULT_BRANCH,
    ]);
    expect(store.getBranchEntries('s2', 'feature').map((item) => item.entryId)).toEqual(['e2']);
  });

  it('查询条目树并按类型过滤', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's3' });
    store.appendEntry('s3', { id: 'a', type: 'user', payload: 1 });
    store.appendEntry('s3', { id: 'b', parentId: 'a', type: 'tool', payload: 2 });
    store.appendEntry('s3', { id: 'c', parentId: 'b', type: 'assistant', payload: 3 });

    const tree = store.getEntryTree('s3');
    expect(tree.leaves.map((leaf) => leaf.id)).toEqual(['c']);
    expect(tree.byId.size).toBe(3);

    const tools = store.getEntries('s3', { type: 'tool' });
    expect(tools.map((entry) => entry.id)).toEqual(['b']);
  });

  it('追加运行记录、事实和统计', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's4' });

    const record = store.appendRecord('s4', {
      id: 'r1',
      lane: 'run',
      runId: 'run-1',
      type: 'command',
      opKind: 'exec',
      payload: { command: 'pnpm test' },
    });
    expect(record).toMatchObject({
      id: 'r1',
      lane: 'run',
      runId: 'run-1',
      type: 'command',
      payload: { command: 'pnpm test' },
    });
    expect(store.getRecords('s4')).toHaveLength(1);

    const fact = store.addFact('s4', { kind: 'env', key: 'node', value: '22' });
    expect(fact).toMatchObject({ kind: 'env', key: 'node', value: '22' });
    expect(store.listFacts('s4')).toHaveLength(1);

    const stats = store.updateStats('s4', {
      messageCount: 3,
      cachedTokens: 10,
      uncachedTokens: 20,
      totalTokens: 30,
      costTotal: 0.5,
    });
    expect(stats).toMatchObject({ messageCount: 3, totalTokens: 30, costTotal: 0.5 });
  });

  it('租约使用 fence 防止旧持有者继续写入', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's5' });

    const first = store.acquireLease('s5', 'owner-a', 60_000);
    expect(first.acquired).toBe(true);
    expect(first.fence).toBe(1);

    const renewed = store.acquireLease('s5', 'owner-a', 60_000);
    expect(renewed.acquired).toBe(true);
    expect(renewed.fence).toBe(2);
    expect(store.validateFence('s5', 'owner-a', first.fence!)).toBe(false);
    expect(store.validateFence('s5', 'owner-a', renewed.fence!)).toBe(true);

    expect(store.releaseLease('s5', 'owner-a')).toBe(true);
    expect(store.getLease('s5')).toBeNull();
  });

  it('删除消息时同步清理后代、泳道、分支指针和统计', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's-del' });
    store.appendEntry('s-del', { id: 'e1', type: 'user', payload: { content: 'q' } });
    store.appendEntry('s-del', {
      id: 'e2',
      parentId: 'e1',
      type: 'assistant',
      payload: { content: 'a' },
    });
    store.appendEntry('s-del', {
      id: 'e3',
      parentId: 'e2',
      type: 'tool',
      payload: { content: 't' },
    });
    store.appendEntry('s-del', {
      id: 'e4',
      parentId: 'e1',
      type: 'assistant',
      payload: { content: 'b' },
      branchId: 'feature',
    });
    store.updateStats('s-del', {
      messageCount: 4,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    });

    const deleted = store.deleteEntries('s-del', ['e1']);

    expect(deleted).toBe(3);
    expect(store.getEntries('s-del').map((entry) => entry.id)).toEqual(['e4']);
    expect(store.getStats('s-del').messageCount).toBe(1);
    expect(store.getLane('s-del', DEFAULT_LANE)?.leafId).toBe('e4');
    expect(store.listBranchTips('s-del').map((tip) => tip.branchId)).toEqual([
      'feature',
    ]);
    expect(store.getBranchEntries('s-del', 'feature').map((item) => item.entryId)).toEqual([
      'e4',
    ]);
    expect(store.deleteEntries('s-del', ['missing'])).toBe(0);
  });

  it('删除整个会话时清理全部关联数据', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's-del-session' });
    store.appendEntry('s-del-session', {
      id: 'e1',
      type: 'user',
      payload: { content: 'q' },
    });
    store.appendRecord('s-del-session', {
      id: 'r1',
      lane: 'run',
      runId: 'run-1',
      type: 'tool_call',
      payload: { tool: 'read_file' },
    });
    store.addFact('s-del-session', { kind: 'task-objective', value: 'demo' });
    store.updateStats('s-del-session', {
      messageCount: 1,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    });
    store.acquireLease('s-del-session', 'owner-a', 60_000);

    expect(store.deleteSession('s-del-session')).toBe(true);
    expect(store.deleteSession('missing-session')).toBe(false);
    expect(store.getSession('s-del-session')).toBeNull();
    expect(store.listSessions()).toHaveLength(0);
    expect(store.getEntries('s-del-session')).toEqual([]);
    expect(store.getRecords('s-del-session')).toEqual([]);
    expect(store.listFacts('s-del-session')).toEqual([]);
    expect(store.getLane('s-del-session', DEFAULT_LANE)).toBeNull();
    expect(store.listBranchTips('s-del-session')).toEqual([]);
    expect(store.getStats('s-del-session').messageCount).toBe(0);
    expect(store.getLease('s-del-session')).toBeNull();
  });
});
