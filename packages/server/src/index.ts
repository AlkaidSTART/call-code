import { SessionStore, DEFAULT_DB_PATH, type SessionStoreConfig } from '@call-code/session-sqlite';
import {
  startWebServer,
  buildWebExport,
  writeWebExport,
  createTaskState,
  runLoop,
  type WebServerHandle,
  type WebServerOptions,
  type WebExport,
  type WebStore,
  type AgentMode,
  type SessionStoreLike,
  type StreamHandlers,
} from '@call-code/agent-core';

export interface ServerConfig {
  dbPath?: string;
  port?: number;
  host?: string;
  clientDir?: string;
  store?: SessionStore;
}

export interface ServerInstance {
  store: SessionStore;
  handle: WebServerHandle;
  port: number;
  host: string;
  snapshot(): WebExport;
  runTask(input: string, options?: Omit<RunTaskOptions, 'sessionStore'>): Promise<string>;
  close(): Promise<void>;
}

export interface RunTaskOptions {
  mode?: AgentMode;
  objective?: string;
  constraints?: string[];
  workspace?: string;
  sessionStore?: SessionStoreLike;
  handlers?: StreamHandlers;
}

/** 使用显式会话存储执行一次 Agent 任务，供 Server SDK 的调用方直接驱动 agent-core。 */
export const runTask = async (
  input: string,
  options: RunTaskOptions = {},
): Promise<string> => {
  const { sessionStore, handlers, ...taskOptions } = options;
  const task = createTaskState(input, taskOptions);
  return runLoop(task, handlers, {
    persist: sessionStore !== undefined,
    sessionStore,
  });
};

/**
 * 启动 Call Code 统一后端服务：集成 SQLite 会话存储与 WebUI WebSocket / 静态托管服务。
 */
export const startServer = async (
  config: ServerConfig = {},
): Promise<ServerInstance> => {
  const dbPath = config.dbPath ?? process.env.SESSION_DB_PATH ?? DEFAULT_DB_PATH;
  const store = config.store ?? new SessionStore({ dbPath });
  const ownsStore = !config.store;

  const port =
    config.port ?? Number(process.env.CALL_CODE_WEB_PORT ?? 4173);
  const host =
    config.host ?? process.env.CALL_CODE_WEB_HOST ?? "127.0.0.1";
  const clientDir = config.clientDir;

  const handle = await startWebServer({
    store,
    port,
    host,
    clientDir,
  });

  return {
    store,
    handle,
    port: handle.port,
    host: handle.host,
    snapshot() {
      return buildWebExport(store);
    },
    runTask(input, options = {}) {
      return runTask(input, { ...options, sessionStore: store });
    },
    async close() {
      await handle.close();
      if (ownsStore) {
        store.close();
      }
    },
  };
};

// 统一对外暴露 agent-core 与 session-sqlite，调用方只需依赖 @call-code/server。
export * from '@call-code/agent-core';
export {
  SCHEMA_SQL,
  DEFAULT_BRANCH,
  DEFAULT_DB_PATH,
  DEFAULT_LANE,
  SessionStore,
} from '@call-code/session-sqlite';
export type {
  BranchEntry,
  BranchTip,
  CreateSessionInput,
  Entry,
  EntryInput,
  Fact,
  GetEntriesOptions,
  Lane,
  LaneMoveInput,
  Lease,
  LeafNode,
  LeaseAcquireResult,
  ListSessionsOptions,
  SessionRecord,
  RecordInput,
  Session,
  SessionStats,
  SessionStoreConfig,
} from '@call-code/session-sqlite';
