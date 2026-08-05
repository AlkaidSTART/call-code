// 会话存储相关的公开类型定义。
// 这里只描述表结构和主要查询结果对应的 TypeScript 类型。

/** 简单的对象类型，避免与全局 Record<T> 工具类型互相干扰 */
type JsonObject = { [key: string]: unknown };

/**
 * 会话基本信息。
 */
export interface Session {
  /** 会话唯一 ID */
  id: string;
  /** 创建时间，ISO 8601 字符串 */
  createdAt: string;
  /** 启动会话时的工作目录 */
  cwd: string;
  /** 父会话 ID，可用于子会话或分支场景 */
  parentSessionId: string | null;
  /** 会话元数据，保存时会被序列化为 JSON */
  metadata: JsonObject;
}

/**
 * 创建会话时需要的输入。
 */
export interface CreateSessionInput {
  /** 会话启动时的工作目录 */
  cwd: string;
  /** 自定义会话 ID，不传则自动生成 */
  id?: string;
  /** 父会话 ID */
  parentSessionId?: string | null;
  /** 会话元数据 */
  metadata?: JsonObject;
}

/**
 * 会话中的一条条目，例如用户消息、助手回复或工具调用。
 */
export interface Entry {
  /** 所属会话 ID */
  sessionId: string;
  /** 会话内递增序号 */
  seq: number;
  /** 条目唯一 ID */
  id: string;
  /** 父条目 ID，用于表达回复关系和分支 */
  parentId: string | null;
  /** 条目类型，例如 user / assistant / tool */
  type: string;
  /** 时间戳，ISO 8601 字符串 */
  timestamp: string;
  /** 条目内容，保存时序列化为 JSON */
  payload: unknown;
}

/**
 * 追加条目时的输入。
 */
export interface EntryInput {
  /** 条目唯一 ID，不传则自动生成 */
  id?: string;
  /** 父条目 ID，不传时默认挂在当前泳道的叶子下 */
  parentId?: string | null;
  /** 条目类型 */
  type: string;
  /** 条目内容，会被序列化为 JSON 后写入 */
  payload: unknown;
  /** 时间戳，不传则使用当前时间 */
  timestamp?: string;
  /** 所属分支 ID，不传时从父条目推导 */
  branchId?: string;
  /** 所属泳道 */
  lane?: string;
}

/**
 * 泳道叶子位置的信息。
 */
export interface Lane {
  /** 所属会话 ID */
  sessionId: string;
  /** 泳道名称 */
  lane: string;
  /** 当前叶子条目 ID */
  leafId: string | null;
}

/**
 * 用于批量追加泳道移动记录的输入。
 */
export interface LaneMoveInput {
  /** 泳道名称 */
  lane: string;
  /** 移动后的叶子条目 ID */
  leafId?: string | null;
}

/**
 * 运行记录或操作历史条目。
 */
export interface Record {
  /** 所属会话 ID */
  sessionId: string;
  /** 会话内递增序号 */
  seq: number;
  /** 记录唯一 ID */
  id: string;
  /** 所属泳道 */
  lane: string;
  /** 运行 ID */
  runId: string | null;
  /** 记录类型 */
  type: string;
  /** 操作类型 */
  opKind: string | null;
  /** 时间戳，ISO 8601 字符串 */
  timestamp: string;
  /** 记录内容，保存时序列化为 JSON */
  payload: unknown;
}

/**
 * 追加记录时的输入。
 */
export interface RecordInput {
  /** 记录唯一 ID，不传则自动生成 */
  id?: string;
  /** 所属泳道 */
  lane: string;
  /** 运行 ID */
  runId?: string | null;
  /** 记录类型 */
  type: string;
  /** 操作类型 */
  opKind?: string | null;
  /** 记录内容 */
  payload: unknown;
  /** 时间戳，不传则使用当前时间 */
  timestamp?: string;
}

/**
 * 会话统计信息。
 */
export interface SessionStats {
  /** 所属会话 ID */
  sessionId: string;
  /** 当前统计的消息数量 */
  messageCount: number;
  /** 缓存 token 数量 */
  cachedTokens: number;
  /** 未缓存 token 数量 */
  uncachedTokens: number;
  /** token 总数 */
  totalTokens: number;
  /** 累计成本 */
  costTotal: number;
}

/**
 * 事实表记录。
 */
export interface Fact {
  /** 所属会话 ID */
  sessionId: string;
  /** 会话内递增序号 */
  seq: number;
  /** 事实类型 */
  kind: string;
  /** 事实键 */
  key: string | null;
  /** 事实值 */
  value: string | null;
}

/**
 * 分支指针记录。
 */
export interface BranchTip {
  /** 所属会话 ID */
  sessionId: string;
  /** 当前 tip 条目 ID */
  tipId: string;
  /** 分支 ID */
  branchId: string;
}

/**
 * 分支条目缓存。
 */
export interface BranchEntry {
  /** 所属会话 ID */
  sessionId: string;
  /** 分支 ID */
  branchId: string;
  /** 条目 ID */
  entryId: string;
  /** 条目序号 */
  entrySeq: number;
  /** 条目类型缓存 */
  entryType: string | null;
  /** 自定义类型缓存 */
  customType: string | null;
}

/**
 * 会话写租约。
 */
export interface Lease {
  /** 所属会话 ID */
  sessionId: string;
  /** 租约持有者 ID */
  ownerId: string;
  /** 单调递增的 fence，用于判断写入是否仍被授权 */
  fence: number;
  /** 过期时间，毫秒时间戳 */
  expiresAtMs: number;
}

/**
 * 查询泳道树时返回的结构。
 */
export interface LeafNode {
  /** 条目 ID */
  id: string;
  /** 父条目 ID */
  parentId: string | null;
  /** 条目序号 */
  seq: number;
  /** 条目类型 */
  type: string;
  /** 时间戳 */
  timestamp: string;
  /** 已解析的条目内容 */
  payload: unknown;
}
