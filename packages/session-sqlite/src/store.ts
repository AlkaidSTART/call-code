import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema';
import type {
  BranchEntry,
  BranchTip,
  CreateSessionInput,
  Entry,
  EntryInput,
  Fact,
  Lane,
  LaneMoveInput,
  Lease,
  LeafNode,
  Record as SessionRecord,
  RecordInput,
  Session,
  SessionStats,
} from './types';

/** 默认数据库文件路径，可用环境变量 SESSION_DB_PATH 覆盖 */
export const DEFAULT_DB_PATH = '.agent-sessions/sessions.db';

/** 默认泳道名称 */
export const DEFAULT_LANE = 'default';

/** 默认分支 ID，主分支统一使用 DEFAULT_BRANCH */
export const DEFAULT_BRANCH = 'main';

/** SQLite 行数据类型，用于辅助解析 */
type SqlRow = Record<string, unknown>;

/**
 * SessionStore 配置。
 */
export interface SessionStoreConfig {
  /** SQLite 数据库文件路径，默认读取 SESSION_DB_PATH，再回退到 .agent-sessions/sessions.db */
  dbPath?: string;
  /** 直接传入一个已打开的 DatabaseSync 实例，测试或复用连接时使用 */
  db?: DatabaseSync;
}

/**
 * 会话分页查询选项。
 */
export interface ListSessionsOptions {
  /** 查询条数上限 */
  limit?: number;
  /** 跳过的条数 */
  offset?: number;
  /** 只查询某个工作目录下的会话 */
  cwd?: string;
}

/**
 * 会话条目查询选项。
 */
export interface GetEntriesOptions {
  /** 查询条数上限，默认取全部 */
  limit?: number;
  /** 起始序号，默认从 0 开始 */
  afterSeq?: number;
  /** 按条目类型过滤 */
  type?: string;
}

/**
 * 租约获取结果。
 */
export interface LeaseAcquireResult {
  /** 获取成功时为 true，已经被其他持有者占用时为 false */
  acquired: boolean;
  /** 当前有效租约信息 */
  lease: Lease | null;
  /** 本次写入需要携带的 fence，未获取到时为 null */
  fence: number | null;
}

/**
 * 基于 node:sqlite 的会话历史存储。
 *
 * 所有历史数据保存在 SQLite 中，支持条目、泳道、分支、运行记录、
 * 事实、统计和写租约。类方法全部为同步实现。
 */
export class SessionStore {
  /** 内部数据库连接 */
  readonly db: DatabaseSync;

  private readonly ownsDb: boolean;
  private readonly statements: {
    insertSession: ReturnType<DatabaseSync['prepare']>;
    insertSequence: ReturnType<DatabaseSync['prepare']>;
    insertStats: ReturnType<DatabaseSync['prepare']>;
    insertLane: ReturnType<DatabaseSync['prepare']>;
    getSessionById: ReturnType<DatabaseSync['prepare']>;
    listSessions: ReturnType<DatabaseSync['prepare']>;
    listSessionsByCwd: ReturnType<DatabaseSync['prepare']>;
    replaceSession: ReturnType<DatabaseSync['prepare']>;
    readSequence: ReturnType<DatabaseSync['prepare']>;
    bumpSequence: ReturnType<DatabaseSync['prepare']>;
    insertEntry: ReturnType<DatabaseSync['prepare']>;
    insertBranchEntry: ReturnType<DatabaseSync['prepare']>;
    insertLaneMove: ReturnType<DatabaseSync['prepare']>;
    insertBranchTip: ReturnType<DatabaseSync['prepare']>;
    updateBranchTip: ReturnType<DatabaseSync['prepare']>;
    insertRecord: ReturnType<DatabaseSync['prepare']>;
    updateLane: ReturnType<DatabaseSync['prepare']>;
    getEntryById: ReturnType<DatabaseSync['prepare']>;
    listEntries: ReturnType<DatabaseSync['prepare']>;
    listEntriesType: ReturnType<DatabaseSync['prepare']>;
    listEntriesAfter: ReturnType<DatabaseSync['prepare']>;
    listEntriesTypeAfter: ReturnType<DatabaseSync['prepare']>;
    listRecords: ReturnType<DatabaseSync['prepare']>;
    getLane: ReturnType<DatabaseSync['prepare']>;
    listLanes: ReturnType<DatabaseSync['prepare']>;
    listBranchEntries: ReturnType<DatabaseSync['prepare']>;
    listFacts: ReturnType<DatabaseSync['prepare']>;
    insertFact: ReturnType<DatabaseSync['prepare']>;
    getBranchTip: ReturnType<DatabaseSync['prepare']>;
    listBranchTips: ReturnType<DatabaseSync['prepare']>;
    getStats: ReturnType<DatabaseSync['prepare']>;
    upsertStats: ReturnType<DatabaseSync['prepare']>;
    insertLease: ReturnType<DatabaseSync['prepare']>;
    takeLease: ReturnType<DatabaseSync['prepare']>;
    getLease: ReturnType<DatabaseSync['prepare']>;
    deleteLease: ReturnType<DatabaseSync['prepare']>;
  };

  constructor(config: SessionStoreConfig = {}) {
    if (config.db) {
      this.db = config.db;
      this.ownsDb = false;
    } else {
      const dbPath = config.dbPath ?? process.env.SESSION_DB_PATH ?? DEFAULT_DB_PATH;
      if (dbPath !== ':memory:') {
        // 确保数据库所在目录存在，避免打开失败
        mkdirSync(dirname(dbPath), { recursive: true });
      }
      this.db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
      this.ownsDb = true;
    }

    this.db.exec(SCHEMA_SQL);
    this.statements = this.prepareStatements();
  }

  /** 编译所有 SQL 语句，字段较多，独立成一个方法方便阅读 */
  private prepareStatements() {
    const db = this.db;
    return {
      insertSession: db.prepare(`
        INSERT INTO sessions (id, created_at, cwd, parent_session_id, metadata)
        VALUES (:id, :createdAt, :cwd, :parentSessionId, :metadata)
      `),
      insertSequence: db.prepare(`
        INSERT INTO session_sequences (session_id, next_seq)
        VALUES (:sessionId, 1)
      `),
      insertStats: db.prepare(`
        INSERT INTO session_stats (session_id, message_count, cached_tokens, uncached_tokens, total_tokens, cost_total)
        VALUES (:sessionId, 0, 0, 0, 0, 0)
      `),
      insertLane: db.prepare(`
        INSERT INTO lanes (session_id, lane, leaf_id)
        VALUES (:sessionId, :lane, NULL)
      `),
      getSessionById: db.prepare(`
        SELECT * FROM sessions WHERE id = :id
      `),
      listSessions: db.prepare(`
        SELECT * FROM sessions ORDER BY created_at DESC LIMIT :limit OFFSET :offset
      `),
      listSessionsByCwd: db.prepare(`
        SELECT * FROM sessions WHERE cwd = :cwd ORDER BY created_at DESC LIMIT :limit OFFSET :offset
      `),
      replaceSession: db.prepare(`
        INSERT INTO sessions (id, created_at, cwd, parent_session_id, metadata)
        VALUES (:id, :createdAt, :cwd, :parentSessionId, :metadata)
        ON CONFLICT(id) DO UPDATE SET
          cwd = excluded.cwd,
          parent_session_id = excluded.parent_session_id,
          metadata = excluded.metadata
      `),
      readSequence: db.prepare(`
        SELECT next_seq FROM session_sequences WHERE session_id = :sessionId
      `),
      bumpSequence: db.prepare(`
        UPDATE session_sequences SET next_seq = next_seq + 1 WHERE session_id = :sessionId
      `),
      insertEntry: db.prepare(`
        INSERT INTO entries (session_id, seq, id, parent_id, type, timestamp, payload)
        VALUES (:sessionId, :seq, :id, :parentId, :type, :timestamp, :payload)
      `),
      insertBranchEntry: db.prepare(`
        INSERT INTO branch_entries (session_id, branch_id, entry_id, entry_seq, entry_type, custom_type)
        VALUES (:sessionId, :branchId, :entryId, :entrySeq, :entryType, :customType)
      `),
      insertLaneMove: db.prepare(`
        INSERT INTO lane_moves (session_id, seq, lane, leaf_id)
        VALUES (:sessionId, :seq, :lane, :leafId)
      `),
      insertBranchTip: db.prepare(`
        INSERT INTO branch_tips (session_id, tip_id, branch_id)
        VALUES (:sessionId, :tipId, :branchId)
      `),
      updateBranchTip: db.prepare(`
        UPDATE branch_tips SET tip_id = :tipId
        WHERE session_id = :sessionId AND branch_id = :branchId
      `),
      insertRecord: db.prepare(`
        INSERT INTO records (session_id, seq, id, lane, run_id, type, op_kind, timestamp, payload)
        VALUES (:sessionId, :seq, :id, :lane, :runId, :type, :opKind, :timestamp, :payload)
      `),
      updateLane: db.prepare(`
        INSERT INTO lanes (session_id, lane, leaf_id)
        VALUES (:sessionId, :lane, :leafId)
        ON CONFLICT(session_id, lane) DO UPDATE SET leaf_id = excluded.leaf_id
      `),
      getEntryById: db.prepare(`
        SELECT * FROM entries WHERE session_id = :sessionId AND id = :id
      `),
      listEntries: db.prepare(`
        SELECT * FROM entries WHERE session_id = :sessionId ORDER BY seq ASC LIMIT :limit
      `),
      listEntriesType: db.prepare(`
        SELECT * FROM entries WHERE session_id = :sessionId AND type = :type ORDER BY seq ASC LIMIT :limit
      `),
      listEntriesAfter: db.prepare(`
        SELECT * FROM entries
        WHERE session_id = :sessionId AND seq > :afterSeq
        ORDER BY seq ASC LIMIT :limit
      `),
      listEntriesTypeAfter: db.prepare(`
        SELECT * FROM entries
        WHERE session_id = :sessionId AND type = :type AND seq > :afterSeq
        ORDER BY seq ASC LIMIT :limit
      `),
      listRecords: db.prepare(`
        SELECT * FROM records
        WHERE session_id = :sessionId
        ORDER BY seq ASC LIMIT :limit OFFSET :offset
      `),
      getLane: db.prepare(`
        SELECT * FROM lanes WHERE session_id = :sessionId AND lane = :lane
      `),
      listLanes: db.prepare(`
        SELECT * FROM lanes WHERE session_id = :sessionId ORDER BY lane ASC
      `),
      listBranchEntries: db.prepare(`
        SELECT * FROM branch_entries
        WHERE session_id = :sessionId AND branch_id = :branchId
        ORDER BY entry_seq ASC
      `),
      listFacts: db.prepare(`
        SELECT * FROM facts
        WHERE session_id = :sessionId
        ORDER BY seq ASC
      `),
      insertFact: db.prepare(`
        INSERT INTO facts (session_id, seq, kind, key, value)
        VALUES (:sessionId, :seq, :kind, :key, :value)
      `),
      getBranchTip: db.prepare(`
        SELECT * FROM branch_tips WHERE session_id = :sessionId AND branch_id = :branchId
      `),
      listBranchTips: db.prepare(`
        SELECT * FROM branch_tips WHERE session_id = :sessionId ORDER BY branch_id ASC
      `),
      getStats: db.prepare(`
        SELECT * FROM session_stats WHERE session_id = :sessionId
      `),
      upsertStats: db.prepare(`
        INSERT INTO session_stats
          (session_id, message_count, cached_tokens, uncached_tokens, total_tokens, cost_total)
        VALUES (:sessionId, :messageCount, :cachedTokens, :uncachedTokens, :totalTokens, :costTotal)
        ON CONFLICT(session_id) DO UPDATE SET
          message_count = excluded.message_count,
          cached_tokens = excluded.cached_tokens,
          uncached_tokens = excluded.uncached_tokens,
          total_tokens = excluded.total_tokens,
          cost_total = excluded.cost_total
      `),
      insertLease: db.prepare(`
        INSERT INTO leases (session_id, owner_id, fence, expires_at_ms)
        VALUES (:sessionId, :ownerId, 1, :expiresAtMs)
      `),
      takeLease: db.prepare(`
        UPDATE leases SET
          owner_id = :ownerId,
          fence = fence + 1,
          expires_at_ms = :expiresAtMs
        WHERE session_id = :sessionId
          AND (owner_id = :ownerId OR expires_at_ms <= :nowMs)
      `),
      getLease: db.prepare(`
        SELECT * FROM leases WHERE session_id = :sessionId
      `),
      deleteLease: db.prepare(`
        DELETE FROM leases WHERE session_id = :sessionId AND owner_id = :ownerId
      `),
    };
  }

  /** 关闭数据库连接（仅当连接由本类创建时） */
  close(): void {
    if (this.ownsDb && this.db.isOpen) {
      this.db.close();
    }
  }

  /**
   * 在事务中执行回调。回调抛错时自动回滚。
   */
  transaction<T>(fn: () => T): T {
    // 如果已经在事务中，使用 savepoint 实现可嵌套，避免子调用再次 BEGIN 报错
    const nested = this.db.isTransaction;
    this.db.exec(nested ? 'SAVEPOINT session_store' : 'BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec(nested ? 'RELEASE session_store' : 'COMMIT');
      return result;
    } catch (err) {
      try {
        this.db.exec(nested ? 'ROLLBACK TO session_store' : 'ROLLBACK');
        if (nested) {
          this.db.exec('RELEASE session_store');
        }
      } catch {
        // 回滚失败时保留原始错误
      }
      throw err;
    }
  }

  /**
   * 创建新会话，并初始化序号、统计、泳道等基础数据。
   */
  createSession(input: CreateSessionInput): Session {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

    this.transaction(() => {
      this.statements.insertSession.run({
        ':id': id,
        ':createdAt': now,
        ':cwd': input.cwd,
        ':parentSessionId': input.parentSessionId ?? null,
        ':metadata': metadata,
      });
      this.statements.insertSequence.run({ ':sessionId': id });
      this.statements.insertStats.run({ ':sessionId': id });
      this.statements.insertLane.run({ ':sessionId': id, ':lane': DEFAULT_LANE });
    });

    const session = this.getSession(id);
    if (!session) {
      throw new Error(`创建会话失败：${id}`);
    }
    return session;
  }

  /**
   * 按 ID 读取会话，不存在时返回 null。
   */
  getSession(id: string): Session | null {
    const row = this.statements.getSessionById.get({ ':id': id });
    return row ? this.mapSession(row) : null;
  }

  /**
   * 分页列出会话，可按工作目录过滤。
   */
  listSessions(options: ListSessionsOptions = {}): Session[] {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const rows = options.cwd
      ? this.statements.listSessionsByCwd.all({ ':cwd': options.cwd, ':limit': limit, ':offset': offset })
      : this.statements.listSessions.all({ ':limit': limit, ':offset': offset });
    return rows.map((row) => this.mapSession(row));
  }

  /**
   * 创建或覆盖一个会话。已存在时更新 cwd、父会话和元数据，不存在时创建。
   */
  replaceSession(input: CreateSessionInput): Session {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    this.statements.replaceSession.run({
      ':id': id,
      ':createdAt': now,
      ':cwd': input.cwd,
      ':parentSessionId': input.parentSessionId ?? null,
      ':metadata': metadata,
    });
    // 如果这是全新会话，补齐序号、统计和泳道数据
    if (!this.statements.readSequence.get({ ':sessionId': id })) {
      this.statements.insertSequence.run({ ':sessionId': id });
      this.statements.insertStats.run({ ':sessionId': id });
      this.statements.insertLane.run({ ':sessionId': id, ':lane': DEFAULT_LANE });
    }
    const session = this.getSession(id);
    if (!session) {
      throw new Error(`覆盖会话失败：${id}`);
    }
    return session;
  }

  /**
   * 按 ID 读取单条条目。
   */
  getEntry(sessionId: string, entryId: string): Entry | null {
    const row = this.statements.getEntryById.get({ ':sessionId': sessionId, ':id': entryId });
    return row ? this.mapEntry(row) : null;
  }

  /**
   * 按序号和类型查询会话条目。
   */
  getEntries(sessionId: string, options: GetEntriesOptions = {}): Entry[] {
    const limit = options.limit ?? 1000;
    const afterSeq = options.afterSeq ?? -1;
    const type = options.type;

    let rows: SqlRow[];
    if (type && afterSeq >= 0) {
      rows = this.statements.listEntriesTypeAfter.all({
        ':sessionId': sessionId,
        ':type': type,
        ':afterSeq': afterSeq,
        ':limit': limit,
      });
    } else if (type) {
      rows = this.statements.listEntriesType.all({
        ':sessionId': sessionId,
        ':type': type,
        ':limit': limit,
      });
    } else if (afterSeq >= 0) {
      rows = this.statements.listEntriesAfter.all({
        ':sessionId': sessionId,
        ':afterSeq': afterSeq,
        ':limit': limit,
      });
    } else {
      rows = this.statements.listEntries.all({ ':sessionId': sessionId, ':limit': limit });
    }

    return rows.map((row) => this.mapEntry(row));
  }

  /**
   * 获取整棵会话条目树，按叶子条目和父节点关系组织。
   */
  getEntryTree(sessionId: string): { leaves: LeafNode[]; byId: Map<string, LeafNode> } {
    const entries = this.getEntries(sessionId, { limit: 100000 });
    const nodes = new Map<string, LeafNode>();
    const children = new Map<string, string[]>();

    for (const entry of entries) {
      const node: LeafNode = {
        id: entry.id,
        parentId: entry.parentId,
        seq: entry.seq,
        type: entry.type,
        timestamp: entry.timestamp,
        payload: entry.payload,
      };
      nodes.set(node.id, node);
      if (node.parentId) {
        const siblings = children.get(node.parentId) ?? [];
        siblings.push(node.id);
        children.set(node.parentId, siblings);
      }
    }

    const leaves = [...nodes.values()].filter((node) => !children.has(node.id));
    return { leaves, byId: nodes };
  }

  /**
   * 向会话追加一条条目。
   *
   * 会同时更新泳道叶子、分支条目缓存和分支指针，并记录一次泳道移动。
   * 默认挂在当前泳道的叶子条目下；如果指定了 parentId，则挂在指定父条目下。
   */
  appendEntry(sessionId: string, input: EntryInput): Entry {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const timestamp = input.timestamp ?? now;
    const lane = input.lane ?? DEFAULT_LANE;
    const payload = JSON.stringify(input.payload);
    const customType = input.type;

    let result: Entry;
    this.transaction(() => {
      // 未指定父条目时，默认从当前泳道的叶子继续
      const parentId = input.parentId ?? this.getLane(sessionId, lane)?.leafId ?? null;

      // 推导分支：已有分支的父条目继续原分支，否则以父条目为分支起点
      let branchId = input.branchId;
      if (!branchId) {
        if (parentId) {
          const parentBranch = this.findEntryBranch(sessionId, parentId);
          branchId = parentBranch ?? parentId;
        } else {
          branchId = DEFAULT_BRANCH;
        }
      }

      const seq = this.nextSeq(sessionId);
      this.statements.insertEntry.run({
        ':sessionId': sessionId,
        ':seq': seq,
        ':id': id,
        ':parentId': parentId,
        ':type': input.type,
        ':timestamp': timestamp,
        ':payload': payload,
      });
      this.statements.insertBranchEntry.run({
        ':sessionId': sessionId,
        ':branchId': branchId,
        ':entryId': id,
        ':entrySeq': seq,
        ':entryType': input.type,
        ':customType': customType,
      });

      // 分支指针更新为新条目
      const tip = this.statements.getBranchTip.get({ ':sessionId': sessionId, ':branchId': branchId });
      if (tip) {
        this.statements.updateBranchTip.run({ ':sessionId': sessionId, ':branchId': branchId, ':tipId': id });
      } else {
        this.statements.insertBranchTip.run({ ':sessionId': sessionId, ':tipId': id, ':branchId': branchId });
      }

      // 泳道叶子前移，并记录移动历史
      this.statements.updateLane.run({ ':sessionId': sessionId, ':lane': lane, ':leafId': id });
      this.statements.insertLaneMove.run({ ':sessionId': sessionId, ':seq': seq, ':lane': lane, ':leafId': id });

      const entry = this.statements.getEntryById.get({ ':sessionId': sessionId, ':id': id });
      if (!entry) {
        throw new Error('追加条目失败');
      }
      result = this.mapEntry(entry);
    });
    // 上面的事务必然执行成功并赋值
    return result!;
  }

  /**
   * 追加一条运行记录，记录会与条目共享同一个会话序号。
   */
  appendRecord(sessionId: string, input: RecordInput): SessionRecord {
    const id = input.id ?? randomUUID();
    const timestamp = input.timestamp ?? new Date().toISOString();
    let result: SessionRecord;
    this.transaction(() => {
      const seq = this.nextSeq(sessionId);
      this.statements.insertRecord.run({
        ':sessionId': sessionId,
        ':seq': seq,
        ':id': id,
        ':lane': input.lane,
        ':runId': input.runId ?? null,
        ':type': input.type,
        ':opKind': input.opKind ?? null,
        ':timestamp': timestamp,
        ':payload': JSON.stringify(input.payload),
      });
      // 记录移动泳道时同步更新泳道叶子
      this.statements.updateLane.run({ ':sessionId': sessionId, ':lane': input.lane, ':leafId': id });
      this.statements.insertLaneMove.run({
        ':sessionId': sessionId,
        ':seq': seq,
        ':lane': input.lane,
        ':leafId': id,
      });
      const row = this.db
        .prepare('SELECT * FROM records WHERE session_id = ? AND id = ?')
        .get(sessionId, id) as SqlRow;
      result = this.mapRecord(row);
    });
    return result!;
  }

  /**
   * 分页查询运行记录。
   */
  getRecords(sessionId: string, options: { limit?: number; offset?: number } = {}): SessionRecord[] {
    const rows = this.statements.listRecords.all({
      ':sessionId': sessionId,
      ':limit': options.limit ?? 500,
      ':offset': options.offset ?? 0,
    });
    return rows.map((row) => this.mapRecord(row));
  }

  /**
   * 移动指定泳道的叶子位置，并记录移动历史。
   */
  moveLane(sessionId: string, input: LaneMoveInput): Lane {
    this.transaction(() => {
      const seq = this.nextSeq(sessionId);
      this.statements.updateLane.run({
        ':sessionId': sessionId,
        ':lane': input.lane,
        ':leafId': input.leafId ?? null,
      });
      this.statements.insertLaneMove.run({
        ':sessionId': sessionId,
        ':seq': seq,
        ':lane': input.lane,
        ':leafId': input.leafId ?? null,
      });
    });
    const lane = this.getLane(sessionId, input.lane);
    if (!lane) {
      throw new Error(`泳道不存在：${input.lane}`);
    }
    return lane;
  }

  /**
   * 读取指定泳道，不存在时返回 null。
   */
  getLane(sessionId: string, lane: string): Lane | null {
    const row = this.statements.getLane.get({ ':sessionId': sessionId, ':lane': lane });
    return row ? this.mapLane(row) : null;
  }

  /**
   * 列出会话内的所有泳道。
   */
  listLanes(sessionId: string): Lane[] {
    const rows = this.statements.listLanes.all({ ':sessionId': sessionId });
    return rows.map((row) => this.mapLane(row));
  }

  /**
   * 追加一条事实。
   */
  addFact(sessionId: string, input: { kind: string; key?: string | null; value?: string | null }): Fact {
    let result: Fact;
    this.transaction(() => {
      const seq = this.nextSeq(sessionId);
      this.statements.insertFact.run({
        ':sessionId': sessionId,
        ':seq': seq,
        ':kind': input.kind,
        ':key': input.key ?? null,
        ':value': input.value ?? null,
      });
      const row = this.db
        .prepare('SELECT * FROM facts WHERE session_id = ? AND seq = ?')
        .get(sessionId, seq) as SqlRow;
      result = this.mapFact(row);
    });
    return result!;
  }

  /**
   * 列出会话内全部事实。
   */
  listFacts(sessionId: string): Fact[] {
    const rows = this.statements.listFacts.all({ ':sessionId': sessionId });
    return rows.map((row) => this.mapFact(row));
  }

  /**
   * 设置分支指针。
   */
  setBranchTip(sessionId: string, branchId: string, tipId: string): BranchTip {
    const existing = this.statements.getBranchTip.get({ ':sessionId': sessionId, ':branchId': branchId });
    if (existing) {
      this.statements.updateBranchTip.run({ ':sessionId': sessionId, ':branchId': branchId, ':tipId': tipId });
    } else {
      this.statements.insertBranchTip.run({ ':sessionId': sessionId, ':tipId': tipId, ':branchId': branchId });
    }
    const row = this.statements.getBranchTip.get({ ':sessionId': sessionId, ':branchId': branchId });
    return this.mapBranchTip(row!);
  }

  /**
   * 列出会话内的分支指针。
   */
  listBranchTips(sessionId: string): BranchTip[] {
    const rows = this.statements.listBranchTips.all({ ':sessionId': sessionId });
    return rows.map((row) => this.mapBranchTip(row));
  }

  /**
   * 读取某个分支下的全部条目缓存。
   */
  getBranchEntries(sessionId: string, branchId: string): BranchEntry[] {
    const rows = this.statements.listBranchEntries.all({ ':sessionId': sessionId, ':branchId': branchId });
    return rows.map((row) => this.mapBranchEntry(row));
  }

  /**
   * 获取会话统计，未初始化时返回默认零值。
   */
  getStats(sessionId: string): SessionStats {
    const row = this.statements.getStats.get({ ':sessionId': sessionId });
    if (row) {
      return this.mapStats(row);
    }
    return {
      sessionId,
      messageCount: 0,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    };
  }

  /**
   * 覆盖写入会话统计。
   */
  updateStats(sessionId: string, stats: Omit<SessionStats, 'sessionId'>): SessionStats {
    this.statements.upsertStats.run({
      ':sessionId': sessionId,
      ':messageCount': stats.messageCount,
      ':cachedTokens': stats.cachedTokens,
      ':uncachedTokens': stats.uncachedTokens,
      ':totalTokens': stats.totalTokens,
      ':costTotal': stats.costTotal,
    });
    return this.getStats(sessionId);
  }

  /**
   * 获取会话写租约。
   *
   * 若租约已过期或归属当前持有者，则直接续租；
   * 若被其他持有者占用且未过期，则返回 acquired=false 且不覆盖 fence。
   */
  acquireLease(sessionId: string, ownerId: string, ttlMs = 60_000): LeaseAcquireResult {
    const nowMs = Date.now();
    const expiresAtMs = nowMs + ttlMs;

    const updated = this.statements.takeLease.run({
      ':sessionId': sessionId,
      ':ownerId': ownerId,
      ':expiresAtMs': expiresAtMs,
      ':nowMs': nowMs,
    });

    if (updated.changes > 0) {
      const row = this.statements.getLease.get({ ':sessionId': sessionId });
      const lease = this.mapLease(row!);
      return { acquired: true, lease, fence: lease.fence };
    }

    try {
      this.statements.insertLease.run({
        ':sessionId': sessionId,
        ':ownerId': ownerId,
        ':expiresAtMs': expiresAtMs,
      });
      const row = this.statements.getLease.get({ ':sessionId': sessionId });
      const lease = this.mapLease(row!);
      return { acquired: true, lease, fence: lease.fence };
    } catch {
      // 并发创建时只剩未过期租约，说明被其他持有者占用
      const row = this.statements.getLease.get({ ':sessionId': sessionId });
      const lease = row ? this.mapLease(row) : null;
      return { acquired: false, lease, fence: null };
    }
  }

  /**
   * 释放由指定持有者拥有的租约。
   */
  releaseLease(sessionId: string, ownerId: string): boolean {
    return this.statements.deleteLease.run({ ':sessionId': sessionId, ':ownerId': ownerId }).changes > 0;
  }

  /**
   * 读取当前租约，不存在时返回 null。
   */
  getLease(sessionId: string): Lease | null {
    const row = this.statements.getLease.get({ ':sessionId': sessionId });
    return row ? this.mapLease(row) : null;
  }

  /**
   * 校验传入的 fence 是否仍为当前有效租约。
   */
  validateFence(sessionId: string, ownerId: string, fence: number): boolean {
    const lease = this.getLease(sessionId);
    return lease !== null && lease.ownerId === ownerId && lease.fence === fence;
  }

  /** 读取并递增会话序号，返回新序号 */
  private nextSeq(sessionId: string): number {
    const row = this.statements.readSequence.get({ ':sessionId': sessionId });
    if (!row) {
      throw new Error(`会话不存在或未初始化序号：${sessionId}`);
    }
    const seq = Number(row.next_seq);
    this.statements.bumpSequence.run({ ':sessionId': sessionId });
    return seq;
  }

  /** 根据父条目推导它所属的分支，找不到时返回 null */
  private findEntryBranch(sessionId: string, entryId: string): string | null {
    const row = this.db
      .prepare(`
        SELECT branch_id FROM branch_entries
        WHERE session_id = ? AND entry_id = ?
        ORDER BY entry_seq DESC LIMIT 1
      `)
      .get(sessionId, entryId) as SqlRow | undefined;
    return row ? String(row.branch_id) : null;
  }

  /** 把 sessions 行解析为 Session 对象 */
  private mapSession(row: SqlRow): Session {
    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      cwd: String(row.cwd),
      parentSessionId: row.parent_session_id == null ? null : String(row.parent_session_id),
      metadata: this.parseJson(row.metadata) as Record<string, unknown>,
    };
  }

  /** 把 entries 行解析为 Entry 对象 */
  private mapEntry(row: SqlRow): Entry {
    return {
      sessionId: String(row.session_id),
      seq: Number(row.seq),
      id: String(row.id),
      parentId: row.parent_id == null ? null : String(row.parent_id),
      type: String(row.type),
      timestamp: String(row.timestamp),
      payload: this.parseJson(row.payload),
    };
  }

  /** 把 records 行解析为 Record 对象 */
  private mapRecord(row: SqlRow): SessionRecord {
    return {
      sessionId: String(row.session_id),
      seq: Number(row.seq),
      id: String(row.id),
      lane: String(row.lane),
      runId: row.run_id == null ? null : String(row.run_id),
      type: String(row.type),
      opKind: row.op_kind == null ? null : String(row.op_kind),
      timestamp: String(row.timestamp),
      payload: this.parseJson(row.payload),
    };
  }

  /** 把 lanes 行解析为 Lane 对象 */
  private mapLane(row: SqlRow): Lane {
    return {
      sessionId: String(row.session_id),
      lane: String(row.lane),
      leafId: row.leaf_id == null ? null : String(row.leaf_id),
    };
  }

  /** 把 facts 行解析为 Fact 对象 */
  private mapFact(row: SqlRow): Fact {
    return {
      sessionId: String(row.session_id),
      seq: Number(row.seq),
      kind: String(row.kind),
      key: row.key == null ? null : String(row.key),
      value: row.value == null ? null : String(row.value),
    };
  }

  /** 把 branch_tips 行解析为 BranchTip 对象 */
  private mapBranchTip(row: SqlRow): BranchTip {
    return {
      sessionId: String(row.session_id),
      tipId: String(row.tip_id),
      branchId: String(row.branch_id),
    };
  }

  /** 把 branch_entries 行解析为 BranchEntry 对象 */
  private mapBranchEntry(row: SqlRow): BranchEntry {
    return {
      sessionId: String(row.session_id),
      branchId: String(row.branch_id),
      entryId: String(row.entry_id),
      entrySeq: Number(row.entry_seq),
      entryType: row.entry_type == null ? null : String(row.entry_type),
      customType: row.custom_type == null ? null : String(row.custom_type),
    };
  }

  /** 把 session_stats 行解析为 SessionStats 对象 */
  private mapStats(row: SqlRow): SessionStats {
    return {
      sessionId: String(row.session_id),
      messageCount: Number(row.message_count),
      cachedTokens: Number(row.cached_tokens),
      uncachedTokens: Number(row.uncached_tokens),
      totalTokens: Number(row.total_tokens),
      costTotal: Number(row.cost_total),
    };
  }

  /** 把 leases 行解析为 Lease 对象 */
  private mapLease(row: SqlRow): Lease {
    return {
      sessionId: String(row.session_id),
      ownerId: String(row.owner_id),
      fence: Number(row.fence),
      expiresAtMs: Number(row.expires_at_ms),
    };
  }

  /** 解析 JSON 字段，解析失败时原样返回字符串 */
  private parseJson(value: unknown): unknown {
    if (value == null) {
      return null;
    }
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
