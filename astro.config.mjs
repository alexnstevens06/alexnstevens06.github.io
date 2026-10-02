import { defineConfig } from 'astro/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
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

/**
 * content/ rasters are glob-imported (src/lib/media.ts), so Vite emits every original
 * into dist/_astro even when no page uses it. Delete originals nothing references;
 * pages only ship the resized AVIF/WebP variants.
 */
function pruneUnusedOriginalsIntegration() {
  return {
    name: 'prune-unused-originals',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const assetsDir = path.join(distDir, '_astro');
        if (!fs.existsSync(assetsDir)) return;
        let corpus = '';
        const walk = (d) => {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(html|css|js|xml|json|svg)$/i.test(e.name)) corpus += fs.readFileSync(p, 'utf8');
          }
        };
        walk(distDir);
        let removed = 0;
        for (const name of fs.readdirSync(assetsDir)) {
          if (!/\.(png|jpe?g|gif)$/i.test(name)) continue;
          if (corpus.includes(name)) continue;
          fs.rmSync(path.join(assetsDir, name));
          removed++;
        }
        logger.info(`removed ${removed} unreferenced original image(s) from _astro/`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://alexnstevens06.github.io',
  output: 'static',
  trailingSlash: 'always',
  // The home page is the single timeline; old section URLs redirect there (static meta refresh, no JS).
  redirects: {
    '/timeline/': '/',
    '/projects/': '/',
    '/contact/': '/',
  },
  integrations: [syncContentIntegration(), pruneUnusedOriginalsIntegration()],
});
