---
cover: lucidscan-mark.jpg
---

# LucidScan — local authenticity checks (hackathon)

Chrome extension + local Python server for on-device text / image / video authenticity checks. Public repo: [alexnstevens06/LucidScan](https://github.com/alexnstevens06/LucidScan). Built for a Fall 2025 hackathon (repo created **2025-10-25 CT**; single substantive commit: “all files at end of hackathon”).

## What it is

- **`chrome_plugin/`** — extension that sends selected text or media URLs to a local `/detect` endpoint and shows a confidence score in a popup.
- **`server.py`** — Flask API that routes `text` / `image` / `video` payloads to detection helpers.
- **`text_detection.py`** / **`detect.py`** — text classifier path plus CLIP/ViT-based image and video heuristics (watermarks, EXIF, Gradio GUI option).

The checked-in root README is still largely an upstream **StableGuard** template (clone instructions point at `muhammad-fiaz/StableGuard`). Treat that marketing block as scaffolding, not the project description. This write-up describes what is actually in the LucidScan tree.

## Honesty / scope

Thin history: one push at hackathon end, not a maintained product. Suitable as a systems/ML side project showing extension ↔ local-model wiring, not as a flagship. Resume claims (fine-tuned models, sub-5s local runs) are aspirational relative to the public commit surface — the code loads open models and runs inference stubs; there is no separate fine-tune artifact in-repo.

## Tech

Python (Flask, PyTorch / Transformers / Gradio), JavaScript Chrome extension (popup + background).

## Dates

October 2025 (hackathon).

## Links

https://github.com/alexnstevens06/LucidScan (public)

## Figures

None. The repo has no usable screenshots or UI captures without third-party / StableGuard branding. Cover left empty for Castellan.
