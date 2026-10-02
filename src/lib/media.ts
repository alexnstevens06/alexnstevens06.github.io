/**
 * Build-time image pipeline (astro:assets + sharp).
 * Rasters under content/ are imported via import.meta.glob so Astro only emits
 * the resized AVIF/WebP variants a page actually asks for. content/ is read-only.
 * SVG diagrams are served from public/content (port-stripped by scripts/sync-content.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const rasters = import.meta.glob<{ default: ImageMetadata }>(
  '/content/**/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}',
  { eager: true },
);

const CONTENT_ROOT = path.join(process.cwd(), 'content');

/** `/content/a%20b/x.jpg` -> `a b/x.jpg` */
function relPath(relUrl: string): string {
  return decodeURIComponent(relUrl.replace(/^\/content\//, ''));
}

export function rasterMeta(relUrl: string): ImageMetadata | null {
  return rasters[`/content/${relPath(relUrl)}`]?.default ?? null;
}

/** Read dimensions via the hidden clone so Astro doesn't mark the original as used (and ship it). */
function dims(meta: ImageMetadata): { width: number; height: number } {
  const m = ((meta as any).clone ?? meta) as ImageMetadata;
  return { width: m.width, height: m.height };
}

export function svgSize(relUrl: string): { width: number; height: number } | null {
  try {
    const raw = fs.readFileSync(path.join(CONTENT_ROOT, relPath(relUrl)), 'utf8').slice(0, 4000);
    const vb = raw.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
    const w = raw.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i);
    const h = raw.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i);
    if (w && h) return { width: Math.round(+w[1]), height: Math.round(+h[1]) };
  } catch {
    /* ignore */
  }
  return null;
}

export type Optimized = { avif: string; webp: string; width: number; height: number };

const AVIF_Q = 50;
const WEBP_Q = 70;

/**
 * Resize a content raster to `width` px (never upscaled). When `height` is given the
 * image is center-cropped to that box (same result as CSS object-fit: cover).
 */
export async function optimize(relUrl: string, width: number, height?: number): Promise<Optimized | null> {
  const meta = rasterMeta(relUrl);
  if (!meta) return null;
  const d = dims(meta);
  const w = Math.min(width, d.width);
  const opts: Record<string, unknown> = { src: meta, width: w };
  if (height) {
    opts.height = Math.round((height * w) / width);
    opts.fit = 'cover';
    opts.position = 'center';
  }
  const [a, b] = await Promise.all([
    getImage({ ...opts, format: 'avif', quality: AVIF_Q } as any),
    getImage({ ...opts, format: 'webp', quality: WEBP_Q } as any),
  ]);
  const ww = Number(b.attributes.width ?? w);
  const hh = Number(b.attributes.height ?? Math.round((d.height * ww) / d.width));
  return { avif: a.src, webp: b.src, width: ww, height: hh };
}

/** Large WebP for gallery click-through (only linked, never eagerly loaded). */
export async function largeHref(relUrl: string, width = 1600): Promise<string> {
  const meta = rasterMeta(relUrl);
  if (!meta) return relUrl;
  const img = await getImage({ src: meta, width: Math.min(width, dims(meta).width), format: 'webp', quality: 80 });
  return img.src;
}
