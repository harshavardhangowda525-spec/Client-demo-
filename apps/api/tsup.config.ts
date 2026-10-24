import { defineConfig } from 'tsup';

// Bundle the workspace packages (TypeScript sources) into the API build; keep
// third-party dependencies (Prisma engine, Better Auth, Fastify) external.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  noExternal: [/^@studio\//],
  external: ['@prisma/client', '.prisma/client'],
});
