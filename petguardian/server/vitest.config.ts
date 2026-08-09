import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Prevent Vite from walking up the tree and loading an unrelated PostCSS/Tailwind
  // config from a parent directory (this is a Node server, not a Vite app).
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
