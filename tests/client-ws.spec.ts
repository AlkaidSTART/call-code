import { afterEach, describe, expect, it } from 'vitest';
import { SessionStore } from '../packages/session-sqlite/src/index';
import type { WebExport } from '@call-code/server/client';
import type { SummarizeFn } from '@agent-core/harness/compaction/compaction';
import {
  connectLiveExport,
  parseCreatedSessionMessage,
  parseSnapshotMessage,
} from '@call-code/server/client';
import {
  startWebServer,
  type WebServerHandle,
} from '../packages/agent-core/src/web/server';

const stores: SessionStore[] = [];
const handles: WebServerHandle[] = [];

const createServer = async (options?: { summarize?: SummarizeFn }) => {
  const store = new SessionStore({ dbPath: ':memory:' });
  stores.push(store);
  const handle = await startWebServer({
    store,
    port: 0,
    summarize: options?.summarize,
  });
  handles.push(handle);
  return { store, handle };
};

afterEach(async () => {
  for (const handle of handles.splice(0)) {
    await handle.close();
  }
  for (const store of stores.splice(0)) {
    store.close();
  }
});

describe('客户端 WebSocket 适配', () => {
  it('解析合法的 sessions.snapshot 消息', () => {
    const data: WebExport = {
      schemaVersion: 1,
      exportedAt: '2026-08-23T00:00:00.000Z',
      sessions: [],
    };

    expect(parseSnapshotMessage({ type: 'sessions.snapshot', data })).toEqual(
      data,
    );
    expect(parseSnapshotMessage({ type: 'other', data })).toBeNull();
    expect(
      parseSnapshotMessage({
        type: 'sessions.snapshot',
        data: { schemaVersion: 2, exportedAt: '', sessions: [] },
      }),
    ).toBeNull();
  });

  it('解析 sessions.created 消息', () => {
    expect(
      parseCreatedSessionMessage({
        type: 'sessions.created',
        sessionId: 's-new-topic',
      }),
    ).toBe('s-new-topic');
    expect(parseCreatedSessionMessage({ type: 'other' })).toBeNull();
    expect(
      parseCreatedSessionMessage({ type: 'sessions.created', sessionId: 1 }),
    ).toBeNull();
  });

  it('连接服务后收到快照并周期性刷新', async () => {
    const { store, handle } = await createServer();
    store.createSession({ cwd: '/tmp/project', id: 's-client' });
    store.appendEntry('s-client', {
      id: 'e1',
      type: 'user',
      payload: { role: 'user', content: 'ping' },
    });

    const snapshots: WebExport[] = [];
    const connection = connectLiveExport({
      url: `ws://127.0.0.1:${handle.port}/ws`,
      timeoutMs: 3000,
      refreshMs: 80,
      onSnapshot: (data) => snapshots.push(data),
    });

    const first = await connection.ready;
    expect(first).not.toBeNull();
    expect(first?.sessions[0].id).toBe('s-client');
    expect(snapshots).toHaveLength(1);

    const deadline = Date.now() + 2000;
    while (snapshots.length < 2 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    expect(snapshots.length).toBeGreaterThan(1);

    connection.close();
  });

  it('deleteMessages 删除消息和会话后同步快照', async () => {
    const { store, handle } = await createServer();
    store.createSession({ cwd: '/tmp/project', id: 's-client-del' });
    store.appendEntry('s-client-del', {
      id: 'e1',
      type: 'user',
      payload: { role: 'user', content: 'ping' },
    });
    store.appendEntry('s-client-del', {
      id: 'e2',
      parentId: 'e1',
      type: 'assistant',
      payload: { role: 'assistant', content: 'pong' },
    });
    store.appendEntry('s-client-del', {
      id: 'e3',
      parentId: 'e2',
      type: 'tool',
      payload: { role: 'tool', content: 'ok' },
    });
    store.updateStats('s-client-del', {
      messageCount: 3,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    });

    const snapshots: WebExport[] = [];
    const connection = connectLiveExport({
      url: `ws://127.0.0.1:${handle.port}/ws`,
      timeoutMs: 3000,
      refreshMs: 3000,
      onSnapshot: (data) => snapshots.push(data),
    });
    const first = await connection.ready;
    expect(first?.sessions[0].entries).toHaveLength(3);

    connection.deleteMessages('s-client-del', ['e2']);

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const latest = snapshots[snapshots.length - 1];
      if (
        latest?.sessions[0].entries.every((entry) => entry.id !== 'e2')
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    expect(snapshots[snapshots.length - 1].sessions[0].entries.map((entry) => entry.id)).toEqual([
      'e1',
    ]);
    expect(snapshots[snapshots.length - 1].sessions[0].stats.messageCount).toBe(1);

    connection.deleteMessages('s-client-del');

    const sessionDeadline = Date.now() + 2000;
    while (Date.now() < sessionDeadline) {
      const latest = snapshots[snapshots.length - 1];
      if (latest?.sessions.length === 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    expect(snapshots[snapshots.length - 1].sessions).toHaveLength(0);

    connection.close();
  });

  it('createSession 创建空会话并返回新会话 ID', async () => {
    const { handle } = await createServer();
    const snapshots: WebExport[] = [];
    const connection = connectLiveExport({
      url: `ws://127.0.0.1:${handle.port}/ws`,
      timeoutMs: 3000,
      refreshMs: 3000,
      onSnapshot: (data) => snapshots.push(data),
    });

    const first = await connection.ready;
    expect(first?.sessions).toHaveLength(0);

    const sessionId = await connection.createSession();
    expect(sessionId).toBeTruthy();

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const latest = snapshots[snapshots.length - 1];
      if (latest?.sessions.some((session) => session.id === sessionId)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    const latest = snapshots[snapshots.length - 1];
    expect(latest?.sessions).toHaveLength(1);
    expect(latest?.sessions[0].id).toBe(sessionId);
    expect(latest?.sessions[0].entries).toEqual([]);

    connection.close();
  });

  it('compactSession 触发服务端压缩并同步快照', async () => {
    const { store, handle } = await createServer({
      summarize: async () => '客户端压缩摘要',
    });
    store.createSession({ cwd: '/tmp/project', id: 's-client-compact' });
    store.appendEntry('s-client-compact', {
      id: 'u1',
      type: 'user',
      payload: { role: 'user', content: '第一轮需求' },
    });
    store.appendEntry('s-client-compact', {
      id: 'a1',
      parentId: 'u1',
      type: 'assistant',
      payload: { role: 'assistant', content: '第一轮回复' },
    });

    const statuses: unknown[] = [];
    const snapshots: WebExport[] = [];
    const connection = connectLiveExport({
      url: `ws://127.0.0.1:${handle.port}/ws`,
      timeoutMs: 3000,
      refreshMs: 3000,
      onSnapshot: (data) => snapshots.push(data),
      onChatStatus: (status) => statuses.push(status),
    });
    const first = await connection.ready;
    expect(first?.sessions[0].entries).toHaveLength(2);

    expect(connection.compactSession('s-client-compact')).toBe(true);

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const latest = snapshots[snapshots.length - 1];
      if (
        latest?.sessions[0].entries.some(
          (entry) => entry.type === 'compaction',
        )
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    const latest = snapshots[snapshots.length - 1];
    const compactionEntry = latest?.sessions[0].entries.find(
      (entry) => entry.type === 'compaction',
    );
    expect(compactionEntry?.text).toContain('客户端压缩摘要');
    expect(statuses.some((s: any) => s.status === 'success')).toBe(true);

    connection.close();
  });
});
