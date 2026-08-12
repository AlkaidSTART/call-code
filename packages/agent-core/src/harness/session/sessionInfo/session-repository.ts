import type { TaskState } from '@agent-core/harness/core/state';
import type { ContextMessage } from '../context/context-types';

/** 默认泳道名称，与 session-sqlite store 保持一致 */
export const DEFAULT_LANE = 'default';

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

/**
 * 会话条目写入参数。
 */
export interface TaskEntryInput {
  /** 条目唯一 ID，不传则由 SessionStore 生成 */
  id?: string;
  /** 父条目 ID，不传时默认挂在当前泳道叶子下 */
  parentId?: string | null;
  /** 条目角色，会同时作为 entries.type 保存 */
  role: 'user' | 'assistant' | 'tool' | 'system';
  /** 条目正文 */
  content: string;
  /** 工具名，tool 类条目使用 */
  tool?: string | null;
  /** 标签，便于后续检索和活动面板展示 */
  tags?: string[];
  /** 分支 ID */
  branchId?: string;
  /** 泳道 */
  lane?: string;
}

/**
 * 运行记录写入参数，对应 schema 中的 records 表。
 */
export interface TaskRecordInput {
  lane?: string;
  runId?: string | null;
  type: string;
  opKind?: string | null;
  payload: unknown;
}

/**
 * 活动面板需要的历史条目。
 */
export interface RecentHistoryItem {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * 活动面板用于扫描相关页面的最近条目。
 */
export interface RecentFeedItem {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
}

let sharedStore: SessionStoreLike | null = null;

/** 获取进程内共享的 SessionStoreLike。 */
export const getSharedSessionStore = (): SessionStoreLike => {
  if (!sharedStore) {
    throw new Error('会话存储未初始化，请先调用 setSharedSessionStore');
  }
  return sharedStore;
};

/** 获取当前共享存储，未初始化时返回 null。 */
export const getSharedSessionStoreOrNull = (): SessionStoreLike | null => sharedStore;

/** 替换共享 SessionStore，测试传入 :memory: 或注入自定义实例时使用。 */
export const setSharedSessionStore = (store: SessionStoreLike | null): void => {
  sharedStore = store;
};

/** 关闭并清空共享 SessionStore。 */
export const closeSharedSessionStore = (): void => {
  sharedStore?.close?.();
  sharedStore = null;
};

const taskMetadata = (task: TaskState) => ({
  mode: task.mode,
  objective: task.objective,
  constraints: task.constraints,
  createdAt: task.createdAt,
});

/**
 * 为任务创建对应会话。已存在时更新元数据，避免覆盖已有历史条目。
 */
export const ensureTaskSession = (
  task: TaskState,
  store: SessionStoreLike = getSharedSessionStore(),
): SessionLike => {
  const cwd = task.workspace ?? process.cwd();
  const metadata = taskMetadata(task);

  if (store.getSession(task.id)) {
    return store.replaceSession({
      id: task.id,
      cwd,
      metadata,
    });
  }

  return store.createSession({
    id: task.id,
    cwd,
    metadata,
  });
};

/**
 * 追加一条 agent 对话条目，并同步递增会话消息数统计。
 */
export const appendTaskEntry = (
  task: TaskState,
  input: TaskEntryInput,
  store: SessionStoreLike = getSharedSessionStore(),
): EntryLike => {
  const entryInput = {
    id: input.id,
    parentId: input.parentId,
    type: input.role,
    payload: {
      role: input.role,
      content: input.content,
      tool: input.tool ?? null,
      tags: input.tags ?? [],
    },
    branchId: input.branchId,
    lane: input.lane ?? DEFAULT_LANE,
  };

  const entry = store.appendEntry(task.id, entryInput);
  const stats = store.getStats(task.id);
  store.updateStats(task.id, {
    ...stats,
    messageCount: stats.messageCount + 1,
  });
  return entry;
};

/**
 * 追加一条运行记录，对应 schema 中的 records 表。
 */
export const appendTaskRecord = (
  task: TaskState,
  input: TaskRecordInput,
  store: SessionStoreLike = getSharedSessionStore(),
): RecordLike =>
  store.appendRecord(task.id, {
    lane: input.lane ?? 'run',
    runId: input.runId ?? task.id,
    type: input.type,
    opKind: input.opKind ?? null,
    payload: input.payload,
  });

const entryToContextMessage = (entry: EntryLike): ContextMessage | null => {
  const payload = entry.payload as { content?: unknown; role?: unknown } | null;
  if (!payload || typeof payload.content !== 'string') {
    return null;
  }

  // user 消息由 context-builder 单独放入，避免重复；tool 结果沿用 runLoop 的 user 角色。
  if (entry.type === 'assistant') {
    return { role: 'assistant', content: payload.content };
  }
  if (entry.type === 'tool') {
    return { role: 'user', content: payload.content };
  }
  if (entry.type === 'compaction' || entry.type === 'branch_summary') {
    const summary = (payload as { summary?: unknown }).summary;
    if (typeof summary !== 'string') {
      return null;
    }
    const prefix = entry.type === 'compaction' ? '[历史摘要]' : '[分支摘要]';
    return { role: 'user', content: `${prefix}\n${summary}` };
  }
  return null;
};

const isContextMessage = (value: unknown): value is ContextMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as { role?: unknown; content?: unknown };
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  );
};

/**
 * 读取任务会话历史，供 runLoop 恢复上下文使用。
 * 只返回 assistant/tool 条目，user 指令由 buildRuntimeContext 单独拼接。
 */
export const readTaskHistory = (
  task: TaskState,
  options: { limit?: number } = {},
  store: SessionStoreLike = getSharedSessionStore(),
): ContextMessage[] => {
  // getEntries 按 seq 升序返回，这里取最近 limit 条，避免只拿到最早的历史。
  const limit = options.limit ?? 1000;
  const entries = store.getEntries(task.id, { limit: Math.max(limit, 1000) });

  let lastCompactionIndex = -1;
  for (let index = entries.length - 1; index >= 0; index--) {
    if (entries[index].type === 'compaction') {
      lastCompactionIndex = index;
      break;
    }
  }

  if (lastCompactionIndex >= 0) {
    const compaction = entries[lastCompactionIndex];
    const payload = compaction.payload as { retainedTail?: unknown } | null;
    const retainedTail = Array.isArray(payload?.retainedTail)
      ? payload.retainedTail.filter(isContextMessage)
      : [];
    const history: ContextMessage[] = [
      ...(entryToContextMessage(compaction) ? [entryToContextMessage(compaction)!] : []),
      ...retainedTail,
      ...entries
        .slice(lastCompactionIndex + 1)
        .map(entryToContextMessage)
        .filter((item): item is ContextMessage => item !== null),
    ];
    return history.slice(-limit);
  }

  return entries
    .slice(-limit)
    .map(entryToContextMessage)
    .filter((item): item is ContextMessage => item !== null);
};

const entryToRecentHistoryItem = (entry: EntryLike): RecentHistoryItem | null => {
  if (entry.type !== 'user' && entry.type !== 'assistant') {
    return null;
  }
  const payload = entry.payload as { content?: unknown } | null;
  if (!payload || typeof payload.content !== 'string') {
    return null;
  }
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    role: entry.type,
    content: payload.content,
    timestamp: entry.timestamp,
  };
};

const entryToRecentFeedItem = (entry: EntryLike): RecentFeedItem | null => {
  const payload = entry.payload as { content?: unknown } | null;
  if (!payload || typeof payload.content !== 'string') {
    return null;
  }
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    role: entry.type,
    content: payload.content,
    timestamp: entry.timestamp,
  };
};

/**
 * 读取最近会话中的 user/assistant 条目，按时间倒序。
 */
export const loadRecentHistory = (
  limit = 8,
  store: SessionStoreLike = getSharedSessionStore(),
): RecentHistoryItem[] => {
  const sessions = store.listSessions({ limit: 20 });
  const result: RecentHistoryItem[] = [];

  for (const session of sessions) {
    const entries = store.getEntries(session.id, { limit: 1000 });
    for (let index = entries.length - 1; index >= 0; index--) {
      const item = entryToRecentHistoryItem(entries[index]);
      if (item) {
        result.push(item);
        if (result.length >= limit) {
          return result;
        }
      }
    }
  }

  return result;
};

/**
 * 读取最近条目，包含 tool 输出，用于扫描相关页面。
 */
export const loadRecentFeed = (
  limit = 200,
  store: SessionStoreLike = getSharedSessionStore(),
): RecentFeedItem[] => {
  const sessions = store.listSessions({ limit: 20 });
  const result: RecentFeedItem[] = [];

  for (const session of sessions) {
    const entries = store.getEntries(session.id, { limit: 1000 });
    for (let index = entries.length - 1; index >= 0; index--) {
      const item = entryToRecentFeedItem(entries[index]);
      if (item) {
        result.push(item);
        if (result.length >= limit) {
          return result;
        }
      }
    }
  }

  return result;
};
