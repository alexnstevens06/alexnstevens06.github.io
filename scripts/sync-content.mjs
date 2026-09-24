import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const CONTENT_ROOT = path.join(ROOT, 'content');
const DEST = path.join(ROOT, 'public', 'content');

/** Basename denylist under projects/comparator/ — never copy into public/dist. */
const COMPARATOR_EXCLUDE = new Set([
  'home.jpg',
  'home.jpeg',
  'home.png',
  'browser.jpg',
  'browser.jpeg',
  'browser.png',
  // PNG has ports baked in; serve port-stripped SVG instead
  'architecture.png',
  'research_case_full.jpg',
  'research_case_full.jpeg',
  'research_case_full.png',
]);

const COMPARATOR_MEDIA_ALLOW = new Set([
  'research_case.jpg',
  'research_case.jpeg',
  'research_case.png',
  'research_case.webp',
  'research_list.jpg',
  'research_list.jpeg',
  'research_list.png',
  'research_list.webp',
  'alerts.jpg',
  'alerts.jpeg',
  'alerts.png',
  'alerts.webp',
  'research_map.jpg',
  'research_map.jpeg',
  'research_map.png',
  'research_map.webp',
  'architecture.svg',
  'architecture.mmd',
  'readme.md',
]);

function shouldSkip(relPosix) {
  const parts = relPosix.split('/');
  if (parts[0] === 'projects' && parts[1] === 'comparator' && parts[2]) {
    const base = parts[2].toLowerCase();
    if (COMPARATOR_EXCLUDE.has(base)) return true;
    const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
    const isMedia = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mmd', '.mp4', '.webm'].includes(ext);
    if (isMedia && !COMPARATOR_MEDIA_ALLOW.has(base)) return true;
  }
  return false;
}

function stripPortsInText(text) {
  return text.replace(/:61926/g, '').replace(/:3000/g, '');
}

function copyTree(src, dest, rel = '') {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const relPosix = rel ? `${rel}/${name}` : name;
    const st = fs.statSync(from);
    if (st.isDirectory()) {
      copyTree(from, to, relPosix);
      continue;
    }
    if (shouldSkip(relPosix)) {
      console.log('sync-content: skip', relPosix);
      continue;
    }
    // Transform architecture diagram copies only (leave content/ source untouched)
    if (
      relPosix === 'projects/comparator/architecture.mmd' ||
      relPosix === 'projects/comparator/architecture.svg' ||
      relPosix.toLowerCase() === 'projects/comparator/readme.md'
    ) {
      const raw = fs.readFileSync(from, 'utf8');
      fs.writeFileSync(to, stripPortsInText(raw));
      console.log('sync-content: port-stripped', relPosix);
      continue;
    }
    fs.copyFileSync(from, to);
  }
}

if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}
if (!fs.existsSync(CONTENT_ROOT)) {
  fs.mkdirSync(DEST, { recursive: true });
  console.log('sync-content: no content/ yet; created empty public/content');
  process.exit(0);
}
copyTree(CONTENT_ROOT, DEST);
console.log('sync-content: copied content/ → public/content/ (with excludes/transforms)');
