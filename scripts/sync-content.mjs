/**
 * Copy the few content files that are served as-is into public/content/:
 *   - SVG diagrams (text, with :61926 / :3000 stripped); .mmd rendered via mermaid-cli if no sibling SVG
 *   - Video files for pages that embed them (splendid-hopper only)
 * Raster images are NOT copied: pages resize them at build time via astro:assets
 * (src/lib/media.ts), so only optimized AVIF/WebP variants end up in dist.
 * content/ itself is never modified.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const CONTENT_ROOT = path.join(ROOT, 'content');
const DEST = path.join(ROOT, 'public', 'content');

const DEFAULT_EXCLUDE = new Set([
  'home.jpg',
  'home.jpeg',
  'home.png',
  'browser.jpg',
  'browser.jpeg',
  'browser.png',
]);

/** Only these content folders may ship raw video. */
const VIDEO_FOLDERS = new Set(['projects/splendid-hopper']);
const VIDEO_EXT = new Set(['.mp4', '.webm']);

function stripPortsInText(text) {
  return text.replace(/:61926/g, '').replace(/:3000/g, '');
}

function readExcludeFromReadme(dir) {
  const readme = ['README.md', 'readme.md', 'index.md'].map((n) => path.join(dir, n)).find((p) => fs.existsSync(p));
  if (!readme) return new Set();
  const raw = fs.readFileSync(readme, 'utf8');
  const excl = new Set();
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      let inExclude = false;
      for (const line of raw.slice(3, end).split(/\r?\n/)) {
        if (/^exclude\s*:/i.test(line)) {
          const rest = line.replace(/^exclude\s*:\s*/i, '').trim();
          if (rest && !rest.startsWith('-')) {
            for (const p of rest.split(',')) excl.add(p.trim().toLowerCase());
            inExclude = false;
          } else {
            inExclude = true;
          }
          continue;
        }
        if (inExclude) {
          const m = line.match(/^\s*-\s+(.+)$/);
          if (m) excl.add(m[1].trim().toLowerCase());
          else if (/^\S/.test(line)) inExclude = false;
        }
      }
    }
  }
  return excl;
}

function renderMermaid(srcMmd, destSvg) {
  const tmpIn = path.join(ROOT, '.home', 'mmd-in', path.basename(srcMmd));
  const tmpOutDir = path.join(ROOT, '.home', 'mmd-out');
  fs.mkdirSync(path.dirname(tmpIn), { recursive: true });
  fs.mkdirSync(tmpOutDir, { recursive: true });
  fs.writeFileSync(tmpIn, stripPortsInText(fs.readFileSync(srcMmd, 'utf8')));
  const outName = path.basename(srcMmd).replace(/\.mmd$/i, '.svg');
  const r = spawnSync(
    'docker',
    [
      'run', '--rm',
      '-u', `${process.getuid?.() ?? 1001}:${process.getgid?.() ?? 1001}`,
      '-v', `${path.dirname(tmpIn)}:/data/in:ro`,
      '-v', `${tmpOutDir}:/data/out`,
      'minlag/mermaid-cli',
      '-i', `/data/in/${path.basename(tmpIn)}`,
      '-o', `/data/out/${outName}`,
      '-b', 'transparent',
    ],
    { encoding: 'utf8' },
  );
  const produced = path.join(tmpOutDir, outName);
  if (r.status === 0 && fs.existsSync(produced)) {
    fs.writeFileSync(destSvg, stripPortsInText(fs.readFileSync(produced, 'utf8')));
    console.log('sync-content: rendered', path.relative(CONTENT_ROOT, srcMmd));
  } else {
    console.warn('sync-content: mermaid-cli failed for', srcMmd, r.stderr || r.stdout);
  }
}

function copyTree(src, dest, rel = '', parentExclude = new Set()) {
  const localExclude = new Set([...parentExclude, ...readExcludeFromReadme(src)]);
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const relPosix = rel ? `${rel}/${name}` : name;
    if (fs.statSync(from).isDirectory()) {
      copyTree(from, path.join(dest, name), relPosix, localExclude);
      continue;
    }
    const lower = name.toLowerCase();
    if (DEFAULT_EXCLUDE.has(lower) || localExclude.has(lower)) continue;
    const ext = path.extname(lower);
    const to = path.join(dest, name);
    if (ext === '.svg') {
      fs.mkdirSync(dest, { recursive: true });
      fs.writeFileSync(to, stripPortsInText(fs.readFileSync(from, 'utf8')));
    } else if (ext === '.mmd') {
      const sibling = from.replace(/\.mmd$/i, '.svg');
      if (!fs.existsSync(sibling)) {
        fs.mkdirSync(dest, { recursive: true });
        renderMermaid(from, to.replace(/\.mmd$/i, '.svg'));
      }
    } else if (VIDEO_EXT.has(ext) && VIDEO_FOLDERS.has(rel)) {
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
if (!fs.existsSync(CONTENT_ROOT)) {
  console.log('sync-content: no content/ yet');
  process.exit(0);
}
copyTree(CONTENT_ROOT, DEST);
console.log('sync-content: done');
