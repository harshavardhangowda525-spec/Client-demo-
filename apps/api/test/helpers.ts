import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app';
import { seedDemo } from '@studio/core/seed';

export const SITE = 'http://localhost:3002';

export async function setup(): Promise<FastifyInstance> {
  await seedDemo({ force: true, withSampleActivity: false });
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function signIn(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/sign-in/email', headers: { origin: SITE, 'content-type': 'application/json' }, payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`sign-in failed ${res.statusCode} ${res.body}`);
  return cookieHeader(res);
}

export function cookieHeader(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

export const json = (res: LightMyRequestResponse) => res.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export const PASSWORDS = {
  admin: ['admin@demo.example', 'DemoAdmin!2026'],
  manager: ['manager@demo.example', 'DemoManager!2026'],
  staff: ['staff@demo.example', 'DemoStaff!2026'],
  customer: ['customer@demo.example', 'DemoCustomer!2026'],
} as const;
