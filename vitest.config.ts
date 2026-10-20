import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/test-env.ts', './vitest.setup.ts'],
    fileParallelism: false,
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/db.test.ts',
    ],
  },
});

