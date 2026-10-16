import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    testTimeout: 35000,
    hookTimeout: 35000,
  },
});
