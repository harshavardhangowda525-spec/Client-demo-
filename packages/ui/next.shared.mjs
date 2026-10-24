// Shared Next.js configuration for the three websites and the admin panel.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** @returns {import('next').NextConfig} */
export function createNextConfig({ extraConnectSrc = [] } = {}) {
  const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
  const isProd = process.env.NODE_ENV === 'production';

  // Razorpay Checkout and Google Maps embeds are the only third parties allowed.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://checkout.razorpay.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com ${extraConnectSrc.join(' ')}`.trim(),
    'frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.google.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  const securityHeaders = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    // Prevents guest access tokens in URLs from leaking to other origins.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
  ];

  return {
    reactStrictMode: true,
    poweredByHeader: false,
    transpilePackages: ['@studio/ui', '@studio/core'],
    outputFileTracingRoot: monorepoRoot,
    turbopack: { root: monorepoRoot },
    async rewrites() {
      // Same-origin proxy to the shared API keeps auth cookies first-party.
      return [
        { source: '/api/:path*', destination: `${api}/api/:path*` },
        { source: '/media/:path*', destination: `${api}/media/:path*` },
      ];
    },
    async headers() {
      return [{ source: '/:path*', headers: securityHeaders }];
    },
  };
}
