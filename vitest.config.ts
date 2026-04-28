import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/test/**/*.spec.ts', 'packages/**/test/**/*.test.ts'],
    exclude: ['**/dist/**', '**/node_modules/**', 'apps/**'],
    reporters: 'default',
  },
});
