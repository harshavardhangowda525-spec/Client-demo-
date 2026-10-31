import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Placeholder credentials: enough to build Google's sign-in URL, never sent to Google.
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.SITE_URL_STUDIO = 'http://localhost:3004';

let app: FastifyInstance;
let h: typeof import('./helpers');
beforeAll(async () => {
  h = await import('./helpers'); // imported after the env is set, so the provider is enabled
  app = await h.setup();
});
afterAll(async () => {
  await app?.close();
});

describe('Sign in with Google', () => {
  it('builds a Google sign-in URL that returns to the studio site', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/sign-in/social',
      headers: { origin: 'http://localhost:3004', 'content-type': 'application/json' },
      payload: { provider: 'google', callbackURL: 'http://localhost:3004/account', errorCallbackURL: 'http://localhost:3004/account?error=google' },
    });
    expect(res.statusCode).toBe(200);
    const url = new URL(h.json(res).url);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('test-client.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3004/api/auth/callback/google');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('rejects callback URLs on untrusted sites', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/sign-in/social',
      headers: { origin: 'http://localhost:3004', 'content-type': 'application/json' },
      payload: { provider: 'google', callbackURL: 'https://evil.example/steal' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('tells the website that Google sign-in is available', async () => {
    const site = h.json(await app.inject({ method: 'GET', url: '/api/v1/sites/STUDIO' }));
    expect(site.integrations.googleSignIn).toBe(true);
  });

  it('removes a Google link when a customer is promoted to staff', async () => {
    const { prisma } = await import('@studio/db');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'customer@demo.example' } });
    await prisma.account.create({ data: { id: `g-${Date.now()}`, accountId: 'google-123', providerId: 'google', userId: user.id } });
    const admin = await h.signIn(app, 'admin@demo.example', 'DemoAdmin!2026');
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${user.id}`, headers: { origin: h.SITE, cookie: admin, 'content-type': 'application/json' }, payload: { role: 'staff' } });
    expect(res.statusCode).toBe(200);
    expect(await prisma.account.count({ where: { userId: user.id, providerId: 'google' } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: user.id, providerId: 'credential' } })).toBe(1);
    await prisma.user.update({ where: { id: user.id }, data: { role: 'customer' } });
  });
});
