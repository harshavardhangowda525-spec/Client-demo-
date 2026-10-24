#!/usr/bin/env node
// Downloads the AI-generated sample images listed in assets/demo-images/catalog.json
// (generated with Floot) and writes responsive WebP variants plus a manifest.
//
//   pnpm images:fetch                 # uses catalog.source.baseUrl
//   FLOOT_ASSET_BASE=https://... pnpm images:fetch
//   pnpm images:fetch --from ./dir    # use already-downloaded PNGs named <key>.png
//
// The sites show labelled placeholders for any image that is not available.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'assets/demo-images/catalog.json');
const outDir = join(root, 'assets/demo-images/generated');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const base = process.env.FLOOT_ASSET_BASE ?? catalog.source.baseUrl;
const fromIdx = process.argv.indexOf('--from');
const fromDir = fromIdx > -1 ? resolve(process.argv[fromIdx + 1]) : null;
const WIDTHS = [640, 1024];

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp is not installed: images will be stored as original PNG without resizing.');
}

await mkdir(outDir, { recursive: true });
const manifest = { generatedAt: new Date().toISOString(), source: catalog.source, images: {} };
let ok = 0;
const failures = [];

for (const [key, entry] of Object.entries(catalog.images)) {
  let buf;
  try {
    if (fromDir) {
      const p = join(fromDir, `${key}.png`);
      await access(p);
      buf = await readFile(p);
    } else {
      const res = await fetch(new URL(entry.path, base), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    }
  } catch (err) {
    failures.push(`${key}: ${err.message}`);
    continue;
  }

  const variants = [];
  let width = entry.w;
  let height = entry.h;
  if (sharp) {
    const meta = await sharp(buf).metadata();
    width = meta.width ?? width;
    height = meta.height ?? height;
    for (const w of WIDTHS) {
      const target = Math.min(w, width);
      const file = `${key}-${target}.webp`;
      await sharp(buf).resize({ width: target }).webp({ quality: 78 }).toFile(join(outDir, file));
      if (!variants.some((v) => v.width === target)) variants.push({ width: target, file });
    }
  } else {
    const file = `${key}.png`;
    await writeFile(join(outDir, file), buf);
    variants.push({ width, file });
  }
  manifest.images[key] = { width, height, variants };
  ok++;
}

await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.info(`Images ready: ${ok}/${Object.keys(catalog.images).length}. Manifest: ${join(outDir, 'manifest.json')}`);
if (failures.length) {
  console.warn(`Could not fetch ${failures.length} image(s); placeholders will be shown for them:\n  ${failures.join('\n  ')}`);
  process.exitCode = ok === 0 ? 1 : 0;
}
