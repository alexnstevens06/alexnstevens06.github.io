import { defineConfig } from 'astro/config';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function syncContentIntegration() {
  const sync = () => {
    const root = path.dirname(fileURLToPath(import.meta.url));
    execFileSync(process.execPath, [path.join(root, 'scripts/sync-content.mjs')], {
      cwd: root,
      stdio: 'inherit',
    });
  };
  return {
    name: 'sync-content',
    hooks: {
      'astro:config:setup': () => {
        sync();
      },
      'astro:build:start': () => {
        sync();
      },
    },
  };
}

export default defineConfig({
  site: 'https://alexnstevens06.github.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [syncContentIntegration()],
});
