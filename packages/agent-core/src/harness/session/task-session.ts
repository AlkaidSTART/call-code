import type { TaskState } from '../core/state';
import type {
  EntryLike,
  RecordLike,
  SessionLike,
  SessionStoreLike,
} from './store-types';
import { getSharedSessionStore } from './store-registry';

/** 默认泳道名称，与 session-sqlite store 保持一致 */
export const DEFAULT_LANE = 'default';

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
