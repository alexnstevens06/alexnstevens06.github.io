# Where `content/` comes from

`content/` is the source of every page's text and images. Until 2026-10-19 it was
gitignored ("Castellan commits separately") and lived only on disk, so the site
could not be rebuilt from this repo. It is now committed on `site-v1`.

## Copies found (2026-10-19, America/Chicago)

| # | Location | What it is |
|---|----------|------------|
| A | tower `/home/alexn/Documents/code/personal-site/content/` | The working tree the published build came from (newest file 2026-10-02 12:40 CT; repo checked out on `site-v1`, same `src/`, `scripts/` and `astro.config.mjs` as `origin/site-v1` c982e78). 77 files. |
| B | box `/workspace/portfolio/content_pack/` | Original 2026-09-24 content pack handed to the site builder. 68 files. |
| C | box `/workspace/tl/timeline.md`, `/workspace/portfolio/work/content_out/`, `/workspace/portfolio/timeline.md` | Loose timeline drafts (no full project folders). |

## Choice: A

Building `origin/site-v1` (c982e78) with copy A, Node 22 (`node:22` Docker image),
produced a `dist/` that is **byte-identical to the deployed `main` (58c99fc) for
every file except `projects/ecen-350-cpu/index.html`**. That one difference is PR #3
(919de9e), which hand-edited the built HTML to say the lab repo is private. The
same sentence was ported into `content/projects/ecen-350-cpu/README.md`, so the
committed content now reproduces what was live before this change.

B and C cannot reproduce the live site:

- **B (content_pack)**: older. It has no `timeline.md`, no `timeline/` folder (COVERS,
  thumbnails, Ignite assets), and older image names (for example `polite/both_edges.jpg`
  where the site uses `polite/polite-both-edges.png`, and `comparator/architecture.png`
  where it uses `comparator-architecture.png`). Every README differs from A. It still has a
  `class-figures` project that A dropped. Its POLITE hook is a one-line earlier
  version.
- **C (timeline drafts)**: `/workspace/tl/timeline.md` has different titles ("JBL Charge 5 BLE
  control experiments", "Comparator, Texas property and legal research platform (IMM
  Research)", "Study Lens, LLM-assisted PDF study app") and entries that are not on the
  site ("Class figures", "Career fair week that led to Samsung", a separate Narayanan
  entry). `work/content_out/timeline.md` and `portfolio/timeline.md` are the older
  bold-line format. 182 to 184 differing lines each.

## Not committed (kept on disk only)

These files are in copy A but are not used by the build, or are private:

- `timeline/EVIDENCE.md`, `SOURCES.md`, `MANIFEST.md`: research notes with mail and Drive
  references and names of other people.
- `timeline.old.md`: superseded timeline.
- `about/headshot_original.jpg`, `about/headshot_alt.jpg`: unused originals.
- `projects/comparator/{research_case,research_list,research_map,alerts,groups}.jpg`:
  app screenshots listed under `exclude:` in the Comparator README (never published).

They are listed in `.gitignore`. A build without them is identical to a build with them.

## Changes made on top of A in the same branch (AS/site-fixes)

- `projects/ecen-350-cpu/README.md`: PR #3's private-repo sentence (see above).
- `projects/polite/README.md` and the POLITE entry in `timeline.md`: rewritten for the current
  single-edge, 2-MAC, decimate-by-2 design. `polite-both-edges.png` is labeled historical.
- `projects/lucidscan/README.md` and the LucidScan entry in `timeline.md`: the approved wording.
- `timeline.md`: Lunabotics is Sep 2025 to Dec 2025. IMM is "IMM Research: Automation Intern", May 2025 to Aug 2025.
- `ALT.md` (new): descriptive alt text per image, read by `src/lib/media.ts`.
