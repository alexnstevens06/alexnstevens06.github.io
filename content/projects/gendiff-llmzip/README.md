---
cover: gendiff-grc-flow.png
title: GenDiff
---

# GenDiff

**Hook:** Ongoing exploratory research with Prof. Krishna Narayanan, January through May 2026. GenDiff transmits a prompt, a seed, and a diff. Not a finished result.

## Context

January–May 2026 research with **Prof. Krishna Narayanan** at Texas A&M. This is ongoing exploratory work, not a finished compression result. Public repos: [`GenDiff`](https://github.com/alexnstevens06/GenDiff) and [`llmzip_extension`](https://github.com/alexnstevens06/llmzip_extension).

## The algorithm

Generative reconstruction compression: instead of encoding the file token-by-token, the sender transmits a prompt, a seed, and a compact diff against a jointly generated candidate. The receiver regenerates that candidate and applies the diff. The cover is the existing GRC flow (`gendiff-grc-flow.png`): a seed, entropy-coded opcodes, and context-aware content bits go out; the receiver regenerates the raw output and applies the diff. Still an open question, not a finished result.

The same January–May 2026 window also included LLMZip-style arithmetic coding over Hugging Face causal LMs. Those runs belong to the research. They are not a finished comparison.

## My role

Sole implementer of the GenDiff prototype and the extension experiments. Literature starting point was the public LLMZip paper/repo.

## Tech

Python, PyTorch, Transformers, custom arithmetic coder (`core/AC`), matplotlib.

## Dates

January–May 2026. GenDiff experiments in that window (April 2026).

## Links

- https://github.com/alexnstevens06/llmzip_extension (public)
- https://github.com/alexnstevens06/GenDiff (public)
