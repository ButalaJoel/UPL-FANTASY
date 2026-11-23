import { defineConfig } from 'vitest/config';

const testDb = process.env.TEST_DATABASE_URL ?? 'postgresql://kiwanja:kiwanja@localhost:5432/kiwanja_test?schema=public';

export default defineConfig({
  test: {
    env: { DATABASE_URL: testDb, NODE_ENV: 'test', JWT_SECRET: 'test-secret' },
    globalSetup: ['./test/globalSetup.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
