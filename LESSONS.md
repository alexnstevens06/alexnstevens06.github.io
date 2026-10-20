# LESSONS

Fleet standard: reason from first principles. Tag every constraint by where it comes from:
`[measured]` (we ran it and saw it), `[Alex]` (stated by Alex), or `[assumption]` (inferred, not yet verified).
Read this file before each design step, and add new lessons here, dated, with a tag.

## 2026-10-20

- [measured] `main` serves the built static Astro output from the repo root via GitHub Pages at alexnstevens.com (`CNAME`); the Astro source lives on `site-v1` (README). Edit source there, not the built HTML on `main`.
- [measured] `.nojekyll` is required so Pages serves `_astro/` as-is (README).
- [measured] CI (`.github/scripts/check_links.py`) fails on any local `href`/`src` pointing at a missing file; run it before publishing.
- [measured] Content fixes made directly in built HTML (e.g. PR #3, ECEN 350 private-repo note) had to be ported back into source `content/` (site-fixes 0326c72); change source first.
- [measured] Images ship as build-time AVIF/WebP with no raw originals, and every image needs descriptive alt text (content/ALT.md).
- [assumption] Timeline/project wording (e.g. LucidScan, POLITE) is approved by Alex before publishing, as the "approved LucidScan wording" commit suggests.
- [assumption] Mark historical figures as historical rather than deleting them (POLITE dual-edge figure precedent).
