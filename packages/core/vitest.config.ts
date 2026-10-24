import { defineConfig } from 'vitest/config';

const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error('TEST_DATABASE_URL must be set (see .env.example). Tests never run against the demo database.');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share one test database; run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testDb,
      NODE_ENV: 'test',
      PAYMENTS_MODE: 'demo',
      RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
      RAZORPAY_KEY_SECRET: 'test_key_secret',
      RESEND_API_KEY: '',
      TWILIO_ACCOUNT_SID: '',
    },
  },
});
