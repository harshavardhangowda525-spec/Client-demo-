import type { FastifyInstance } from 'fastify';
import { handleRazorpayWebhook } from '@studio/core';
import { registry } from '../http/registry';

/**
 * Provider webhooks. Signatures are computed over the exact raw body, so this
 * scope keeps the body as an unparsed string. Exempt from CSRF origin checks
 * (server-to-server) but protected by HMAC signature verification.
 */
export async function registerWebhookRoutes(app: FastifyInstance) {
  await app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 512 * 1024 }, (_req, body, done) => done(null, body));
    scope.post('/api/v1/webhooks/razorpay', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (req) => {
      const sig = req.headers['x-razorpay-signature'];
      const eventId = req.headers['x-razorpay-event-id'];
      const result = await handleRazorpayWebhook(String(req.body ?? ''), typeof sig === 'string' ? sig : undefined, typeof eventId === 'string' ? eventId : undefined);
      return { received: true, duplicate: result.duplicate };
    });
  });
  registry.push({
    method: 'POST', url: '/api/v1/webhooks/razorpay', summary: 'Razorpay webhook (HMAC-SHA256 signature over the raw body, de-duplicated by X-Razorpay-Event-Id)', tags: ['Payments'], access: 'public',
    handler: async () => undefined,
  });
}
