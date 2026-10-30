# alexnstevens06.github.io

Personal site for Alex Stevens, served by GitHub Pages from the root of `main` at [alexnstevens.com](https://alexnstevens.com) (set by `CNAME`).

## What is in this branch

`AS/editorial-mvp` carries both the Astro source and the static files Pages serves:

- `src/`, `content/`, `astro.config.mjs`: the site. Text and images come from `content/`. Nothing in the templates invents a bio or a project.
- `index.html`, `timeline/`, `projects/`, `contact/`, `_astro/`: the built site at the repository root, which is what GitHub Pages publishes (`.nojekyll` keeps `_astro/`).
- `content/projects/splendid-hopper/`: the gif and videos those pages reference directly.

The editorial skin is variant C from the remodel notes: Fraunces for display, Source Sans 3 for text, hairline rules, greyscale photographs, and one explorable record rule. Diagrams and charts stay in color.

## Preview locally

No build is required to read the site. From the repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Pages: `/`, `/timeline/`, `/projects/`, `/contact/`, and `/projects/<slug>/`.

## Rebuild

Node 22 or newer.

```sh
npm ci
npm run build
npm run publish:root
```

`npm run build` writes `dist/`. `publish:root` copies the pages and `_astro/` onto the repository root. It leaves `content/`, the source, and repo metadata in place.

## CI

`.github/workflows/ci.yml` runs `.github/scripts/check_links.py`, which parses every HTML file and fails if a local `href` or `src` points at a file that does not exist.

## License

MIT, see `LICENSE`.
