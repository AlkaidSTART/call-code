import { SessionStore } from '../packages/session-sqlite/src/index';
import { DEFAULT_DB_PATH } from '../packages/session-sqlite/src/store';
import { startWebServer } from '@web/server';

const main = async () => {
  const dbPath = process.env.SESSION_DB_PATH ?? DEFAULT_DB_PATH;
  const store = new SessionStore({ dbPath });
  const port = Number(process.env.CALL_CODE_WEB_PORT ?? 4173);
  const handle = await startWebServer({ store, port });

  const shutdown = async () => {
    await handle.close();
    store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Web 会话面板已启动: http://127.0.0.1:${handle.port}`);
};

main().catch((error) => {
  console.error(
    `启动失败: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
