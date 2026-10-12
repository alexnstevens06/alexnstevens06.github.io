# alexnstevens06.github.io

Personal site for Alex Stevens, served by GitHub Pages from the root of `main` at [alexnstevens.com](https://alexnstevens.com) (set by `CNAME`).

## What is in this branch

`main` holds the built static output of an Astro site, not the Astro source:

- `index.html`: the home page, with the timeline and project cards.
- `projects/<slug>/index.html`: one page per project. `projects/`, `timeline/`, and `contact/` index pages redirect to `/`.
- `_astro/`: the CSS and the AVIF/WebP images that Astro generated.
- `content/projects/`: extra media used by project pages.
- `.nojekyll`: tells GitHub Pages to serve the files as they are, including `_astro/`.

The Astro source lives on the `site-v1` branch (draft PR #1).

## Tech

- [Astro](https://astro.build) static site generation, with build-time AVIF/WebP images
- GitHub Pages hosting with a custom domain

## Preview locally

No build step is needed for `main`. Serve the repository root with any static file server:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## CI

`.github/workflows/ci.yml` runs `.github/scripts/check_links.py`, which parses every HTML file and fails if a local `href` or `src` points at a file that does not exist in the repo.

## License

MIT, see `LICENSE`.
