/**
 * SessionStoreLike 是 agent-core 依赖的最小会话存储接口。
 * 具体实现由 session-sqlite 的 SessionStore 提供，避免 agent-core 反向依赖存储包。
 */
export interface SessionStoreLike {
  close?(): void;
  getSession(id: string): SessionLike | null;
  createSession(input: {
    id?: string;
    cwd: string;
    parentSessionId?: string | null;
    metadata?: Record<string, unknown>;
  }): SessionLike;
  replaceSession(input: {
    id?: string;
    cwd: string;
    parentSessionId?: string | null;
    metadata?: Record<string, unknown>;
  }): SessionLike;
  appendEntry(
    sessionId: string,
    input: {
      id?: string;
      parentId?: string | null;
      type: string;
      payload: unknown;
      branchId?: string;
      lane?: string;
    },
  ): EntryLike;
  appendRecord(
    sessionId: string,
    input: {
      lane: string;
      runId?: string | null;
      type: string;
      opKind?: string | null;
      payload: unknown;
    },
  ): RecordLike;
  getStats(sessionId: string): SessionStatsLike;
  updateStats(
    sessionId: string,
    stats: Omit<SessionStatsLike, 'sessionId'>,
  ): SessionStatsLike;
  getEntries(
    sessionId: string,
    options: { limit?: number },
  ): EntryLike[];
  listSessions(options: { limit?: number }): SessionLike[];
}

/** 会话基本信息的最小形状 */
export interface SessionLike {
  id: string;
  createdAt: string;
  cwd: string;
  parentSessionId: string | null;
  metadata: Record<string, unknown>;
}

/** 条目信息的最小形状 */
export interface EntryLike {
  sessionId: string;
  seq: number;
  id: string;
  parentId: string | null;
  type: string;
  timestamp: string;
  payload: unknown;
}

/** 记录信息的最小形状 */
export interface RecordLike {
  sessionId: string;
  seq: number;
  id: string;
  lane: string;
  runId: string | null;
  type: string;
  opKind: string | null;
  timestamp: string;
  payload: unknown;
}

/** 会话统计的最小形状 */
export interface SessionStatsLike {
  sessionId: string;
  messageCount: number;
  cachedTokens: number;
  uncachedTokens: number;
  totalTokens: number;
  costTotal: number;
}
