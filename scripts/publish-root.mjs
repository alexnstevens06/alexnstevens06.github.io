import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run npm run build first.');
  process.exit(1);
}

function copy(rel) {
  const from = path.join(dist, rel);
  if (!fs.existsSync(from)) {
    console.error(`dist/${rel} is missing.`);
    process.exit(1);
  }
  fs.cpSync(from, path.join(root, rel), { recursive: true });
}

fs.rmSync(path.join(root, '_astro'), { recursive: true, force: true });
copy('_astro');
copy('index.html');
copy('favicon.svg');

for (const dir of ['timeline', 'contact', 'projects']) {
  fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  copy(dir);
}

console.log('Copied dist pages and _astro onto the repository root.');
