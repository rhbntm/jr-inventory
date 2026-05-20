import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: [],
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/db.test.ts',
      '**/movements.test.ts',
    ],
  },
});
