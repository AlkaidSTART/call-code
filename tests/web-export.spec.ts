import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from '../packages/session-sqlite/src/index';
import {
  buildWebExport,
  writeWebExport,
} from '../packages/agent-core/src/web/export';

describe('WebExport', () => {
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

  it('构建 GitHub Pages 客户端可读的会话快照', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's-web' });
    store.appendEntry('s-web', {
      id: 'e1',
      type: 'user',
      payload: { role: 'user', content: 'hello' },
    });
    store.appendEntry('s-web', {
      id: 'e2',
      parentId: 'e1',
      type: 'assistant',
      payload: { role: 'assistant', content: 'hi', tags: ['model-response'] },
    });
    store.appendEntry('s-web', {
      id: 'e3',
      parentId: 'e2',
      type: 'tool',
      payload: { role: 'tool', content: '{"path":"/tmp/x"}', tool: 'read_file' },
    });
    store.updateStats('s-web', {
      messageCount: 3,
      cachedTokens: 10,
      uncachedTokens: 20,
      totalTokens: 30,
      costTotal: 0.1,
    });
    store.appendRecord('s-web', {
      id: 'r1',
      lane: 'run',
      runId: 'run-1',
      type: 'tool_call',
      opKind: 'read_file',
      payload: { tool: 'read_file', path: '/tmp/x' },
    });
    store.addFact('s-web', { kind: 'task-objective', key: 'objective', value: 'demo' });

    const data = buildWebExport(store);

    expect(data.schemaVersion).toBe(1);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].entries.map((entry) => entry.type)).toEqual([
      'user',
      'assistant',
      'tool',
    ]);
    expect(data.sessions[0].entries[1].text).toBe('hi');
    expect(data.sessions[0].entries[1].tags).toEqual(['model-response']);
    expect(data.sessions[0].stats.totalTokens).toBe(30);
    expect(data.sessions[0].records).toHaveLength(1);
    expect(data.sessions[0].facts).toHaveLength(1);
  });

  it('可以把快照写入静态 JSON 文件', () => {
    const store = createStore();
    store.createSession({ cwd: '/tmp/project', id: 's-json' });
    store.appendEntry('s-json', {
      id: 'e1',
      type: 'user',
      payload: { role: 'user', content: 'ping' },
    });

    const dir = mkdtempSync(join(tmpdir(), 'call-code-web-export-'));
    const outputPath = join(dir, 'data.json');

    try {
      const data = writeWebExport(store, outputPath);
      const parsed = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        schemaVersion: number;
        sessions: Array<{ id: string }>;
      };

      expect(data.sessions).toHaveLength(1);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.sessions[0].id).toBe('s-json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
