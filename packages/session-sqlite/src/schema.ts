// SQLite 会话历史存储的完整建表语句。
// 注释统一使用中文，方便后续维护。
export const SCHEMA_SQL = `
-- 会话主表：记录一次会话的基本信息和元数据
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                -- 会话唯一 ID
  created_at TEXT NOT NULL,           -- 创建时间（ISO 8601 字符串）
  cwd TEXT NOT NULL,                  -- 会话启动时的工作目录
  parent_session_id TEXT NULL,        -- 父会话 ID，用于子会话/分支
  metadata TEXT NULL                  -- 会话元数据，JSON 字符串
) WITHOUT ROWID;

-- 按创建时间倒序查询会话
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
-- 按工作目录查询会话
CREATE INDEX IF NOT EXISTS idx_sessions_cwd ON sessions(cwd);
-- 按父会话查询子会话
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id);

-- 会话条目表：按顺序保存会话历史中的每条记录
CREATE TABLE IF NOT EXISTS entries (
  session_id TEXT NOT NULL,           -- 所属会话 ID
  seq INTEGER NOT NULL,               -- 会话内递增序号
  id TEXT NOT NULL,                   -- 条目唯一 ID
  parent_id TEXT NULL,                -- 父条目 ID，用于表达回复/分支关系
  type TEXT NOT NULL,                 -- 条目类型，例如 user/assistant/tool
  timestamp TEXT NOT NULL,            -- 条目时间戳（ISO 8601 字符串）
  payload TEXT NOT NULL,              -- 条目内容，JSON 字符串
  PRIMARY KEY (session_id, id),
  UNIQUE (session_id, seq)
);

-- 按会话内序号查询条目
CREATE INDEX IF NOT EXISTS idx_entries_session_seq ON entries(session_id, seq);
-- 按父条目查询子条目
CREATE INDEX IF NOT EXISTS idx_entries_session_parent ON entries(session_id, parent_id);
-- 按类型和序号查询条目
CREATE INDEX IF NOT EXISTS idx_entries_session_type_seq ON entries(session_id, type, seq);

-- 会话序号表：为每个会话维护全局递增序号
CREATE TABLE IF NOT EXISTS session_sequences (
  session_id TEXT PRIMARY KEY,
  next_seq INTEGER NOT NULL
) WITHOUT ROWID;

-- 会话统计表：记录消息数、缓存 token、总 token 和成本
CREATE TABLE IF NOT EXISTS session_stats (
  session_id TEXT PRIMARY KEY,
  message_count INTEGER NOT NULL,
  cached_tokens REAL NOT NULL,
  uncached_tokens REAL NOT NULL,
  total_tokens REAL NOT NULL,
  cost_total REAL NOT NULL
) WITHOUT ROWID;

-- 分支条目缓存表：entries 中的 parent 链接是权威数据，
-- 这张表只用于加速分支扫描。
CREATE TABLE IF NOT EXISTS branch_entries (
  session_id TEXT NOT NULL,           -- 所属会话 ID
  branch_id TEXT NOT NULL,            -- 分支 ID
  entry_id TEXT NOT NULL,             -- 条目 ID
  entry_seq INTEGER NOT NULL,         -- 条目在会话内的序号
  entry_type TEXT NULL,               -- 条目类型缓存
  custom_type TEXT NULL,              -- 自定义类型缓存
  PRIMARY KEY (session_id, branch_id, entry_id)
) WITHOUT ROWID;

-- 按分支和序号扫描分支条目
CREATE INDEX IF NOT EXISTS idx_branch_entries_session_branch_seq ON branch_entries(session_id, branch_id, entry_seq);
-- 按条目反向查询所属分支
CREATE INDEX IF NOT EXISTS idx_branch_entries_session_entry ON branch_entries(session_id, entry_id);
-- 按条目类型扫描分支
CREATE INDEX IF NOT EXISTS idx_branch_entries_session_branch_type_seq ON branch_entries(session_id, branch_id, entry_type, entry_seq);
-- 按自定义类型扫描分支
CREATE INDEX IF NOT EXISTS idx_branch_entries_session_branch_custom_seq ON branch_entries(session_id, branch_id, custom_type, entry_seq);

-- 泳道表：每个会话的每个泳道指向当前叶子条目
CREATE TABLE IF NOT EXISTS lanes (
  session_id TEXT NOT NULL,           -- 所属会话 ID
  lane TEXT NOT NULL,                 -- 泳道名称
  leaf_id TEXT NULL,                  -- 当前叶子条目 ID
  PRIMARY KEY (session_id, lane)
) WITHOUT ROWID;

-- 按叶子条目查询泳道
CREATE INDEX IF NOT EXISTS idx_lanes_session_leaf ON lanes(session_id, leaf_id);

-- 记录表：保存运行记录、操作历史等结构化事件
CREATE TABLE IF NOT EXISTS records (
  session_id TEXT NOT NULL,           -- 所属会话 ID
  seq INTEGER NOT NULL,               -- 会话内递增序号
  id TEXT NOT NULL,                   -- 记录唯一 ID
  lane TEXT NOT NULL,                 -- 所属泳道
  run_id TEXT NULL,                   -- 运行 ID
  type TEXT NOT NULL,                 -- 记录类型
  op_kind TEXT NULL,                  -- 操作类型
  timestamp TEXT NOT NULL,            -- 时间戳（ISO 8601 字符串）
  payload TEXT NOT NULL,              -- 记录内容，JSON 字符串
  PRIMARY KEY (session_id, id),
  UNIQUE (session_id, seq)
) WITHOUT ROWID;

-- 按会话内序号查询记录
CREATE INDEX IF NOT EXISTS idx_records_session_seq ON records(session_id, seq);
-- 按泳道、类型、序号查询记录
CREATE INDEX IF NOT EXISTS idx_records_session_lane_type_seq ON records(session_id, lane, type, seq);
-- 按泳道、类型、操作类型、序号查询记录
CREATE INDEX IF NOT EXISTS idx_records_session_lane_type_op_kind_seq ON records(session_id, lane, type, op_kind, seq);
-- 按运行 ID 查询记录
CREATE INDEX IF NOT EXISTS idx_records_session_run_id_seq ON records(session_id, run_id, seq);

-- 泳道移动表：记录泳道叶子位置的变化历史
CREATE TABLE IF NOT EXISTS lane_moves (
  session_id TEXT NOT NULL,           -- 所属会话 ID
  seq INTEGER NOT NULL,               -- 会话内递增序号
  lane TEXT NOT NULL,                 -- 泳道名称
  leaf_id TEXT NULL,                  -- 移动后的叶子条目 ID
  PRIMARY KEY (session_id, seq)
) WITHOUT ROWID;

-- 按泳道和序号查询移动记录
CREATE INDEX IF NOT EXISTS idx_lane_moves_session_lane_seq ON lane_moves(session_id, lane, seq);

-- 事实表：保存会话内沉淀的事实/键值信息
CREATE TABLE IF NOT EXISTS facts (
  session_id TEXT NOT NULL,           -- 所属会话 ID
  seq INTEGER NOT NULL,               -- 会话内递增序号
  kind TEXT NOT NULL,                 -- 事实类型
  key TEXT NULL,                      -- 事实键
  value TEXT NULL,                    -- 事实值
  PRIMARY KEY (session_id, seq)
) WITHOUT ROWID;

-- 按类型和键查询事实
CREATE INDEX IF NOT EXISTS idx_facts_session_kind_key_seq ON facts(session_id, kind, key, seq);

-- 分支指针表：记录每个分支当前的 tip 条目
CREATE TABLE IF NOT EXISTS branch_tips (
  session_id TEXT NOT NULL,           -- 所属会话 ID
  tip_id TEXT NOT NULL,               -- 当前 tip 条目 ID
  branch_id TEXT NOT NULL,            -- 分支 ID
  PRIMARY KEY (session_id, tip_id),
  UNIQUE (session_id, branch_id)
) WITHOUT ROWID;

-- 会话写租约表：用 fence 防止过期持有者在新持有者接管后继续写入
CREATE TABLE IF NOT EXISTS leases (
  session_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,             -- 租约持有者 ID
  fence INTEGER NOT NULL,             -- 单调递增的栅栏号
  expires_at_ms INTEGER NOT NULL      -- 过期时间戳（毫秒）
) WITHOUT ROWID;
`;
