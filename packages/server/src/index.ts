import { SessionStore, DEFAULT_DB_PATH, type SessionStoreConfig } from '../../session-sqlite/src/index';
import {
  startWebServer,
  buildWebExport,
  writeWebExport,
  type WebServerHandle,
  type WebServerOptions,
  type WebExport,
  type WebStore,
} from '../../agent-core/src/index';

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
  close(): Promise<void>;
}

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
  const host = config.host ?? "127.0.0.1";
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
    async close() {
      await handle.close();
      if (ownsStore) {
        store.close();
      }
    },
  };
};

// 重新导出 agent-core 与 session-sqlite 核心能力与类型
export {
  SessionStore,
  DEFAULT_DB_PATH,
  startWebServer,
  buildWebExport,
  writeWebExport,
};
export type {
  SessionStoreConfig,
  WebServerHandle,
  WebServerOptions,
  WebExport,
  WebStore,
};
export * from '../../agent-core/src/index';
