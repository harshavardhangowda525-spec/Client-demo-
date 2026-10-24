import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { prisma } from '@studio/db';
import { notify } from '@studio/core';
import { apiConfig } from './config';

const cfg = apiConfig();

/**
 * Better Auth (maintained authentication library) with database sessions.
 * Email delivery for verification / reset uses the notification adapters: if
 * no email provider is configured, the message is stored as a development
 * preview and the UI labels the flow as a simulation.
 */
export const auth = betterAuth({
  appName: 'Studio Platform',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: cfg.BETTER_AUTH_SECRET,
  baseURL: cfg.BETTER_AUTH_URL,
  basePath: '/api/auth',
  trustedOrigins: cfg.allowedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      await notify({ template: 'auth.password_reset', recipient: user.email, data: { name: user.name, link: url } });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await notify({ template: 'auth.verify_email', recipient: user.email, data: { name: user.name, link: url } });
    },
  },
  user: {
    additionalFields: {
      // Never accepted from sign-up input; roles are assigned by administrators.
      role: { type: 'string', input: false, defaultValue: 'customer', required: false },
      isActive: { type: 'boolean', input: false, defaultValue: true, required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: cfg.NODE_ENV !== 'test',
    window: 60,
    max: 30,
    customRules: {
      '/sign-in/email': { window: 60, max: 8 },
      '/sign-up/email': { window: 300, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
    },
  },
  advanced: {
    cookiePrefix: 'studio',
    useSecureCookies: cfg.BETTER_AUTH_URL.startsWith('https://'),
    database: { generateId: () => randomUUID() },
    ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
  },
  // Bearer tokens let the future mobile app use the same sessions without cookies.
  plugins: [bearer()],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.customerProfile.upsert({
            where: { userId: user.id },
            create: { userId: user.id, fullName: user.name, email: user.email },
            update: {},
          });
        },
      },
    },
  },
});
