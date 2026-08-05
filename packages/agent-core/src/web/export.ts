import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  EntryLike,
  SessionStoreLike,
  SessionStatsLike,
} from '../session/session-repository';

/** GitHub Pages 客户端读取的会话快照格式。 */
export interface WebEntry {
  seq: number;
  id: string;
  parentId: string | null;
  type: string;
  role: string;
  timestamp: string;
  text?: string;
  tool?: string | null;
  tags?: string[];
  payload: unknown;
}

/** 运行记录的最小导出形状。 */
export interface WebRecord {
  seq: number;
  id: string;
  lane: string;
  runId: string | null;
  type: string;
  opKind: string | null;
  timestamp: string;
  payload: unknown;
}

/** 事实表的最小导出形状。 */
export interface WebFact {
  seq: number;
  kind: string;
  key: string | null;
  value: string | null;
}

/** 单个会话的导出结构。 */
export interface WebSession {
  id: string;
  createdAt: string;
  cwd: string;
  parentSessionId: string | null;
  metadata: Record<string, unknown>;
  stats: SessionStatsLike;
  entries: WebEntry[];
  records?: WebRecord[];
  facts?: WebFact[];
}

/** 完整导出文件结构。 */
export interface WebExport {
  schemaVersion: 1;
  exportedAt: string;
  sessions: WebSession[];
}

/** export.ts 需要的存储最小接口，兼容 SessionStoreLike 及 SQLite 扩展方法。 */
type WebStore = SessionStoreLike & {
  getRecords?: (sessionId: string, options?: { limit?: number; offset?: number }) => WebRecord[];
  listFacts?: (sessionId: string) => WebFact[];
};

const entryText = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const content = (payload as { content?: unknown }).content;
  return typeof content === 'string' ? content : undefined;
};

const entryRole = (entry: EntryLike): string => {
  const payload = entry.payload as { role?: unknown } | null;
  return payload && typeof payload.role === 'string' ? payload.role : entry.type;
};

const entryTool = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const tool = (payload as { tool?: unknown }).tool;
  return typeof tool === 'string' ? tool : null;
};

const entryTags = (payload: unknown): string[] | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const tags = (payload as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) {
    return undefined;
  }
  const result = tags.filter((tag): tag is string => typeof tag === 'string');
  return result.length > 0 ? result : undefined;
};

const toWebEntry = (entry: EntryLike): WebEntry => {
  const role = entryRole(entry);
  const text = entryText(entry.payload);
  const tool = entryTool(entry.payload);
  const tags = entryTags(entry.payload);

  return {
    seq: entry.seq,
    id: entry.id,
    parentId: entry.parentId,
    type: entry.type,
    role,
    timestamp: entry.timestamp,
    text,
    tool,
    tags,
    payload: entry.payload,
  };
};

/**
 * 把会话存储导出为静态客户端可用的 JSON 结构。
 * records 和 facts 是可选能力，存储未实现时自动省略。
 */
export const buildWebExport = (
  store: WebStore,
  options: { limit?: number } = {},
): WebExport => {
  const sessions = store.listSessions({ limit: options.limit ?? 100 });

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    sessions: sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      cwd: session.cwd,
      parentSessionId: session.parentSessionId,
      metadata: session.metadata,
      stats: store.getStats(session.id),
      entries: store.getEntries(session.id, { limit: 100000 }).map(toWebEntry),
      records: store.getRecords
        ? store.getRecords(session.id).map((record) => ({
            seq: record.seq,
            id: record.id,
            lane: record.lane,
            runId: record.runId,
            type: record.type,
            opKind: record.opKind,
            timestamp: record.timestamp,
            payload: record.payload,
          }))
        : undefined,
      facts: store.listFacts
        ? store.listFacts(session.id).map((fact) => ({
            seq: fact.seq,
            kind: fact.kind,
            key: fact.key,
            value: fact.value,
          }))
        : undefined,
    })),
  };
};

/** 把会话快照写入 packages/client 可读取的静态 JSON 文件。 */
export const writeWebExport = (
  store: WebStore,
  outputPath: string,
  options: { limit?: number } = {},
): WebExport => {
  const data = buildWebExport(store, options);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
};
