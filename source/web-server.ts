import { startServer } from '@server';

const main = async () => {
  const server = await startServer();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Web 会话面板已启动: http://${server.host}:${server.port}`);
};

main().catch((error) => {
  console.error(
    `启动失败: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
