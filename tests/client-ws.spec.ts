import { afterEach, describe, expect, it } from 'vitest';
import { SessionStore } from '../packages/session-sqlite/src/index';
import type { WebExport } from '@call-code/server/client';
import {
  connectLiveExport,
  parseSnapshotMessage,
} from '@call-code/server/client';
import {
  startWebServer,
  type WebServerHandle,
} from '../packages/agent-core/src/web/server';

const stores: SessionStore[] = [];
const handles: WebServerHandle[] = [];

const createServer = async () => {
  const store = new SessionStore({ dbPath: ':memory:' });
  stores.push(store);
  const handle = await startWebServer({ store, port: 0 });
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
});
