// Writes the generated OpenAPI document to docs/openapi.json.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { buildOpenApi } from './http/registry';

const app = await buildApp();
await app.ready();
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/openapi.json');
writeFileSync(out, JSON.stringify(buildOpenApi('http://localhost:4000'), null, 2) + '\n');
console.info(`Wrote ${out}`);
await app.close();
process.exit(0);
