import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 10000,
  },
});
