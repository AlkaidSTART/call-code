import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DB_PATH, SessionStore } from '../packages/session-sqlite/src/index';
import { writeWebExport } from '@web/export';

const defaultOutput = fileURLToPath(
  new URL('../packages/client/public/data.json', import.meta.url),
);
const outputPath = process.argv[2] ? resolve(process.argv[2]) : defaultOutput;
const store = new SessionStore({
  dbPath: process.env.SESSION_DB_PATH ?? DEFAULT_DB_PATH,
});

try {
  const data = writeWebExport(store, outputPath);
  console.log(`已导出 ${data.sessions.length} 个会话到 ${outputPath}`);
} finally {
  store.close();
}
