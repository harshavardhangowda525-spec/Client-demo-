import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@studio/db';
import { json, setup, signIn, SITE } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await setup();
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Membership" CASCADE');
});
afterAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Membership" CASCADE');
  await app?.close();
});

const post = (url: string, cookie: string, payload: unknown = {}) =>
  app.inject({ method: 'POST', url, headers: { origin: SITE, cookie, 'content-type': 'application/json' }, payload: payload as Record<string, unknown> });

describe('Membership API', () => {
  it('lists plans publicly and needs a signed-in customer to buy', async () => {
    const plans = json(await app.inject({ method: 'GET', url: '/api/v1/membership/plans' }));
    expect(plans.map((p: { key: string }) => p.key)).toEqual(['plus', 'pro', 'advanced']);
    expect(json(await app.inject({ method: 'GET', url: '/api/v1/me/membership' })).membership).toBeNull();
    const res = await app.inject({ method: 'POST', url: '/api/v1/membership/checkout', headers: { origin: SITE, 'content-type': 'application/json' }, payload: { planKey: 'pro' } });
    expect(res.statusCode).toBe(401);
  });

  it('a customer buys Pro (demo payment), becomes a member and gets member prices on quotes', async () => {
    const cookie = await signIn(app, 'customer@demo.example', 'DemoCustomer!2026');
    const service = await prisma.service.findFirstOrThrow({ where: { slug: 'portrait-photography' } });
    const full = json(await app.inject({ method: 'POST', url: '/api/v1/quotes', headers: { origin: SITE, cookie, 'content-type': 'application/json' }, payload: { serviceId: service.id } }));
    expect(full.membership).toBeNull();

    const checkout = json(await post('/api/v1/membership/checkout', cookie, { planKey: 'pro', priceMinor: 1 }));
    expect(checkout.provider).toBe('DEMO');
    expect(checkout.amountMinor).toBe(59_900); // the browser cannot set the price
    const done = json(await post(`/api/v1/membership/${checkout.membershipId}/simulate`, cookie, { outcome: 'success' }));
    expect(done).toMatchObject({ status: 'ACTIVE', planKey: 'pro' });

    const me = json(await app.inject({ method: 'GET', url: '/api/v1/me/membership', headers: { cookie } }));
    expect(me.membership.plan.name).toBe('Pro');
    const member = json(await app.inject({ method: 'POST', url: '/api/v1/quotes', headers: { origin: SITE, cookie, 'content-type': 'application/json' }, payload: { serviceId: service.id } }));
    expect(member.membership).toMatchObject({ planName: 'Pro', bps: 5000 });
    expect(member.discountMinor).toBe(Math.round(full.subtotalMinor / 2));
  });

  it('admins edit plan prices; staff cannot buy', async () => {
    const admin = await signIn(app, 'admin@demo.example', 'DemoAdmin!2026');
    const plans = json(await app.inject({ method: 'GET', url: '/api/v1/admin/membership/plans', headers: { cookie: admin } }));
    const plus = plans.find((p: { key: string }) => p.key === 'plus');
    const res = await app.inject({ method: 'PUT', url: `/api/v1/admin/membership/plans/${plus.id}`, headers: { origin: SITE, cookie: admin, 'content-type': 'application/json' }, payload: { ...plus, priceMinor: 19_900 } });
    expect(res.statusCode).toBe(200);
    expect(json(await app.inject({ method: 'GET', url: '/api/v1/membership/plans' })).find((p: { key: string }) => p.key === 'plus').priceMinor).toBe(19_900);
    await app.inject({ method: 'PUT', url: `/api/v1/admin/membership/plans/${plus.id}`, headers: { origin: SITE, cookie: admin, 'content-type': 'application/json' }, payload: { ...plus, priceMinor: 29_900 } });
    expect((await post('/api/v1/membership/checkout', admin, { planKey: 'pro' })).statusCode).toBe(403);
    const customer = await signIn(app, 'customer@demo.example', 'DemoCustomer!2026');
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/memberships', headers: { cookie: customer } })).statusCode).toBe(403);
  });
});
