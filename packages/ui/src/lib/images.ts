import 'server-only';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import catalog from '../../../../assets/demo-images/catalog.json' with { type: 'json' };

interface ManifestEntry {
  variants: { width: number; file: string }[];
  width: number;
  height: number;
}

type CatalogEntry = { path: string; w: number; h: number; alt: string };
const CATALOG = catalog.images as Record<string, CatalogEntry>;

let cache: { mtime: number; data: Record<string, ManifestEntry> } | null = null;

function manifestPath() {
  return process.env.MEDIA_MANIFEST_PATH ?? resolve(process.cwd(), '../../assets/demo-images/generated/manifest.json');
}

/** Reads the manifest written by `pnpm images:fetch` (re-read when it changes). The path is resolved at run time, so it is excluded from build tracing. */
function manifest(): Record<string, ManifestEntry> {
  const p = manifestPath();
  if (!existsSync(/*turbopackIgnore: true*/ p)) return {};
  const mtime = statSync(/*turbopackIgnore: true*/ p).mtimeMs;
  if (!cache || cache.mtime !== mtime) cache = { mtime, data: JSON.parse(readFileSync(/*turbopackIgnore: true*/ p, 'utf8')).images ?? {} };
  return cache.data;
}

export interface ResolvedImage {
  key: string;
  alt: string;
  width: number;
  height: number;
  src: string | null;
  srcSet: string | null;
}

export function resolveImage(key: string | null | undefined, altOverride?: string): ResolvedImage {
  const entry = key ? CATALOG[key] : undefined;
  const m = key ? manifest()[key] : undefined;
  const variants = m?.variants ?? [];
  const largest = variants[variants.length - 1];
  return {
    key: key ?? 'missing',
    alt: altOverride ?? entry?.alt ?? '',
    width: m?.width ?? entry?.w ?? 1200,
    height: m?.height ?? entry?.h ?? 800,
    src: largest ? `/media/${largest.file}` : null,
    srcSet: variants.length ? variants.map((v) => `/media/${v.file} ${v.width}w`).join(', ') : null,
  };
}
