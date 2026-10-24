import { defineConfig } from 'vitest/config';

const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error('TEST_DATABASE_URL must be set. API tests never run against the demo database.');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['../../packages/core/test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testDb,
      NODE_ENV: 'test',
      PAYMENTS_MODE: 'demo',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-0123456789',
      BETTER_AUTH_URL: 'http://localhost:4000',
      RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    },
  },
});
