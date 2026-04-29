import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/test/**/*.spec.ts', 'packages/**/test/**/*.test.ts'],
    exclude: ['**/dist/**', '**/node_modules/**', 'apps/**'],
    reporters: 'default',
    alias: {
      '@agent-core': path.resolve(__dirname, './packages/agent-core/src'),
      '@core': path.resolve(__dirname, './packages/agent-core/src/core'),
      '@tools': path.resolve(__dirname, './packages/agent-core/src/tools'),
      '@config': path.resolve(__dirname, './packages/agent-core/src/config'),
      '@types': path.resolve(__dirname, './packages/agent-core/src/types'),
      '@utils': path.resolve(__dirname, './packages/agent-core/src/utils'),
      '@web': path.resolve(__dirname, './packages/agent-core/src/web'),
      '@prompt': path.resolve(__dirname, './packages/agent-core/src/prompt'),
    },
  },
});
