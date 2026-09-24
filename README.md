# alexnstevens06.github.io

Personal portfolio site for **Alex Stevens**. Astro static site (`output: 'static'`), minimal JS, light/dark via `prefers-color-scheme`.

**Live URL (once Pages is enabled on `main`):** https://alexnstevens06.github.io

## Stack

- [Astro](https://astro.build) (static)
- Content loaded at build time from `content/` (source of truth)
- Deploy: `.github/workflows/deploy.yml` (withastro/action + deploy-pages), triggered on push to `main`

## Local build (Node 22+)

Tower’s system Node is too old; use Docker:

```bash
docker run --rm -u "$(id -u):$(id -g)" \
  -e HOME=/app/.home -e npm_config_cache=/app/.npm-cache \
  -v "$PWD":/app -w /app node:22 \
  npm install

docker run --rm -u "$(id -u):$(id -g)" \
  -e HOME=/app/.home -e npm_config_cache=/app/.npm-cache \
  -v "$PWD":/app -w /app node:22 \
  npm run build
```

Preview:

```bash
docker run --rm -u "$(id -u):$(id -g)" \
  -e HOME=/app/.home -e npm_config_cache=/app/.npm-cache \
  -p 4321:4321 -v "$PWD":/app -w /app node:22 \
  npx astro preview --host 0.0.0.0 --port 4321
```

## Adding content (Progenitor)

Do **not** invent copy in the site code. Drop files under `content/`; rebuild to pick them up. At build time, `content/` is copied into `public/content/` so images are served at `/content/...`.

### About (`content/about/`)

| File | Purpose |
|------|---------|
| `bio.md` or `README.md` | Short bio (Markdown). Optional YAML frontmatter. |
| `headshot.jpg` (or `.png` / `.webp`) | Home page portrait |

Useful frontmatter keys on the bio file:

```yaml
---
email: you@example.com
github: https://github.com/you
linkedin: https://linkedin.com/in/you
resume: https://example.com/resume.pdf
---
```

### Timeline

| File | Purpose |
|------|---------|
| `content/timeline.md` | Semester-by-semester narrative (rendered as-is on `/timeline/`) |
| `content/timeline/ignite/*.png` | SEC Ignite / LiteLock visuals; lead image `capacitive-cell-charge-discharge.png` |

### Contact


Same frontmatter fields as above, or a top-level `content/contact.md` with `email` / URL fields. Missing fields render a visible **TODO** placeholder.

### Projects (`content/projects/<slug>/`)

Preferred layout (what Progenitor uses): `content/projects/<slug>/`. Flat `content/<slug>/` still works as a fallback.

Each project page always exists for the slugs below. Content is optional; without it the page shows a TODO box.

| Site slug | Page URL | Preferred folder |
|-----------|----------|------------------|
| `polite` | `/projects/polite/` | `content/projects/polite/` |
| `comparator` | `/projects/comparator/` | `content/projects/comparator/` |
| `gendiff-llmzip` | `/projects/gendiff-llmzip/` | `content/projects/gendiff-llmzip/` |
| `splendid-hopper` | `/projects/splendid-hopper/` | `content/projects/splendid-hopper/` |
| `study-lens` | `/projects/study-lens/` | `content/projects/study-lens/` |
| `aggie-scheduler` | `/projects/aggie-scheduler/` | `content/projects/aggie-scheduler/` |
| `lucidscan` | `/projects/lucidscan/` | `content/projects/lucidscan/` |
| `ecen-350-cpu` | `/projects/ecen-350-cpu/` | `content/projects/ecen-350-cpu/` |
| `class-figures` | `/projects/class-figures/` | `content/projects/class-figures/` |
| `jbl-ble` | `/projects/jbl-ble/` | `content/projects/jbl-ble/` |

Per project folder:

| File | Purpose |
|------|---------|
| `README.md` | Write-up (Markdown). Optional frontmatter: `title`, `summary` / `description` |
| `*.png` / `*.jpg` / `*.webp` / … | Gallery images (web-sized) |
| `*.mp4` / `*.webm` | Gallery videos |

Example:

```text
content/
  about/
    bio.md
    headshot.jpg
  projects/
    polite/
      README.md
      demo.webp
  SOURCES.md
```

`SOURCES.md` / `MANIFEST.md` are for Progenitor bookkeeping; the site does not render them. **Do not commit `content/` from this bot** — Castellan stages the content pack.

### Comparator media rules

Build copies of `content/` **exclude** `projects/comparator/home.jpg` and `browser.jpg` (never shipped to `dist/`). Gallery stems allowed: `research_case`, `research_list`, `alerts`, `research_map`. Architecture is served from a build-time copy of `architecture.svg` with `:61926` / `:3000` stripped (source files under `content/` are never modified).


### Mapping source of truth

Folder → slug mapping lives in `src/lib/projects.ts`. Update that file if Progenitor settles on different folder names.

## Git / deploy notes

- Feature work happens on `site-v1` (or other branches); merge to `main` to deploy.
- Do not enable GitHub Pages until ready; the workflow file is already present.
- Never commit `node_modules/`, `dist/`, `.home/`, or secrets.

## Deploy workflow note

The Astro Pages workflow file lives on disk at `.github/workflows/deploy.yml` (withastro/action@v6 + deploy-pages, `push` to `main` + `workflow_dispatch`). Pushing it requires a GitHub token with the `workflow` scope; the bot OAuth token on tower does not have that scope, so the file is intentionally **not** in this branch yet. A human (or a token with `workflow`) should add/commit it before enabling Pages.
