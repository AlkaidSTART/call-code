import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: [
      {
        find: /^@call-code\/server\/client$/,
        replacement: fileURLToPath(
          new URL('../server/src/client.ts', import.meta.url),
        ),
      },
      {
        find: /^@call-code\/server$/,
        replacement: fileURLToPath(
          new URL('../server/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
  server: {
    proxy: {
      // 开发模式下把 WebSocket 请求转发给 web:serve 会话服务
      '/ws': {
        target: 'ws://127.0.0.1:4173',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
