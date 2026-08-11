import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.spec.ts',
      'tests/**/*.test.ts',
    ],
    exclude: ['**/dist/**', '**/node_modules/**', 'apps/**'],
    reporters: 'default',
    alias: [
      { find: '@agent-core', replacement: path.resolve(__dirname, './packages/agent-core/src') },
      { find: '@core', replacement: path.resolve(__dirname, './packages/agent-core/src/harness/core') },
      { find: /^@tools$/, replacement: path.resolve(__dirname, './packages/agent-core/src/harness/tools/index.ts') },
      { find: /^@tools\//, replacement: path.resolve(__dirname, './packages/agent-core/src/harness/tools') + '/' },
      { find: '@config', replacement: path.resolve(__dirname, './packages/agent-core/src/config') },
      { find: '@types', replacement: path.resolve(__dirname, './packages/agent-core/src/types') },
      { find: '@utils', replacement: path.resolve(__dirname, './packages/agent-core/src/utils') },
      { find: '@web', replacement: path.resolve(__dirname, './packages/agent-core/src/web') },
      { find: '@prompt', replacement: path.resolve(__dirname, './packages/agent-core/src/harness/prompt') },
      { find: '@policy', replacement: path.resolve(__dirname, './packages/agent-core/src/harness/policy') },
      { find: '@protocol', replacement: path.resolve(__dirname, './packages/agent-core/src/harness/protocol') },
    ],
  },
});
