---
title: Comparator
cover: comparator-architecture.png
exclude:
  - research_case.jpg
  - research_list.jpg
  - research_map.jpg
  - alerts.jpg
  - groups.jpg
---

# Comparator

**Hook:** A web UI and API for property and court research. Development runs on my tower machine. Production deploys a committed git SHA.

## What it is

Comparator is a research app with a web UI and an API. I develop it on my tower machine. A production deploy is a committed git SHA, not a dirty working tree.

The UI includes a court-document viewer. Documents are also ingested into Google Drive.

## Architecture

Public county and court sources feed two stacks. On tower, the development stack is scrapers and extractors, a local database, an API, and the web UI. Production is the same shape: ingest, an API, and the web UI, plus Google Drive for documents. The diagram on this page is that layout. It does not include host names beyond tower and the production machine, ports, or credentials.

## Dates

January 2026 to present.

## Links

No public repository.
