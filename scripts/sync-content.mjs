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

function stripPortsInText(text) {
  return text.replace(/:61926/g, '').replace(/:3000/g, '');
}

function readExcludeFromReadme(dir) {
  const readme = ['README.md', 'readme.md', 'index.md'].map((n) => path.join(dir, n)).find((p) => fs.existsSync(p));
  if (!readme) return new Set();
  const raw = fs.readFileSync(readme, 'utf8');
  const excl = new Set();
  // frontmatter exclude: list or comma-separated
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const fm = raw.slice(3, end);
      const lines = fm.split(/\r?\n/);
      let inExclude = false;
      for (const line of lines) {
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

const SKIP_FILES = new Set(['sources.md', 'manifest.md', 'evidence.md']);

function shouldSkip(relPosix, localExclude) {
  const base = path.basename(relPosix).toLowerCase();
  if (DEFAULT_EXCLUDE.has(base)) return true;
  if (localExclude.has(base)) return true;
  if (SKIP_FILES.has(base)) return true;
  return false;
}

function ensureMermaidSvg(srcMmd, destSvg) {
  // Prefer transforming an existing sibling .svg from content
  const srcSvg = srcMmd.replace(/\.mmd$/i, '.svg');
  if (fs.existsSync(srcSvg)) {
    fs.writeFileSync(destSvg, stripPortsInText(fs.readFileSync(srcSvg, 'utf8')));
    console.log('sync-content: port-stripped svg from', path.relative(CONTENT_ROOT, srcSvg));
    return;
  }
  // Render via mermaid-cli docker image
  const tmpIn = path.join(ROOT, '.home', 'mmd-in', path.basename(srcMmd));
  const tmpOutDir = path.join(ROOT, '.home', 'mmd-out');
  fs.mkdirSync(path.dirname(tmpIn), { recursive: true });
  fs.mkdirSync(tmpOutDir, { recursive: true });
  fs.writeFileSync(tmpIn, stripPortsInText(fs.readFileSync(srcMmd, 'utf8')));
  const outName = path.basename(srcMmd).replace(/\.mmd$/i, '.svg');
  const r = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-u',
      `${process.getuid?.() ?? 1001}:${process.getgid?.() ?? 1001}`,
      '-v',
      `${path.dirname(tmpIn)}:/data/in:ro`,
      '-v',
      `${tmpOutDir}:/data/out`,
      'minlag/mermaid-cli',
      '-i',
      `/data/in/${path.basename(tmpIn)}`,
      '-o',
      `/data/out/${outName}`,
      '-b',
      'transparent',
    ],
    { encoding: 'utf8' },
  );
  const produced = path.join(tmpOutDir, outName);
  if (r.status === 0 && fs.existsSync(produced)) {
    fs.copyFileSync(produced, destSvg);
    console.log('sync-content: rendered', path.relative(CONTENT_ROOT, srcMmd));
  } else {
    console.warn('sync-content: mermaid-cli failed for', srcMmd, r.stderr || r.stdout);
    // Still write stripped mmd next to dest for debugging; skip svg
  }
}

function copyTree(src, dest, rel = '', parentExclude = new Set()) {
  fs.mkdirSync(dest, { recursive: true });
  const localExclude = new Set([...parentExclude, ...readExcludeFromReadme(src)]);
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const relPosix = rel ? `${rel}/${name}` : name;
    const st = fs.statSync(from);
    if (st.isDirectory()) {
      copyTree(from, to, relPosix, localExclude);
      continue;
    }
    if (shouldSkip(relPosix, localExclude)) {
      console.log('sync-content: skip', relPosix);
      continue;
    }
    const lower = name.toLowerCase();
    if (lower.endsWith('.mmd')) {
      fs.writeFileSync(to, stripPortsInText(fs.readFileSync(from, 'utf8')));
      const destSvg = to.replace(/\.mmd$/i, '.svg');
      ensureMermaidSvg(from, destSvg);
      continue;
    }
    if (lower.endsWith('.md') || lower.endsWith('.svg') || lower.endsWith('.txt') || lower.endsWith('.mmd')) {
      fs.writeFileSync(to, stripPortsInText(fs.readFileSync(from, 'utf8')));
      continue;
    }
    fs.copyFileSync(from, to);
  }
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
if (!fs.existsSync(CONTENT_ROOT)) {
  fs.mkdirSync(DEST, { recursive: true });
  console.log('sync-content: no content/ yet');
  process.exit(0);
}
copyTree(CONTENT_ROOT, DEST);
console.log('sync-content: done');
