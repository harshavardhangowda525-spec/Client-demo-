import { buildApp } from './app';
import { apiConfig } from './config';

const cfg = apiConfig();
const app = await buildApp();

try {
  await app.listen({ host: cfg.API_HOST, port: cfg.API_PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}
