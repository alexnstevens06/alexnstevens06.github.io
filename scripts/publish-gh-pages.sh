#!/usr/bin/env bash
# Publish the Astro static build to the orphan `gh-pages` branch on origin.
#
# Usage (from repo root on tower):
#   ./scripts/publish-gh-pages.sh
#
# Builds inside Docker (node:22), writes dist/.nojekyll, then force-with-lease
# pushes ONLY the orphan gh-pages branch (never main / site-v1). Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="gh-pages"
WORKTREE="$ROOT/.home/gh-pages-publish"
IMAGE="${PUBLISH_NODE_IMAGE:-node:22}"

echo "==> Building site in Docker (${IMAGE})"
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -e HOME=/app/.home \
  -e npm_config_cache=/app/.npm-cache \
  -v "$ROOT":/app \
  -w /app \
  -v /var/run/docker.sock:/var/run/docker.sock \
  "$IMAGE" \
  npm run build

if [[ ! -d dist ]]; then
  echo "error: dist/ missing after build" >&2
  exit 1
fi

# GitHub Pages: skip Jekyll processing
touch dist/.nojekyll

echo "==> Preparing orphan ${BRANCH} worktree at ${WORKTREE}"
rm -rf "$WORKTREE"
mkdir -p "$(dirname "$WORKTREE")"

# Fresh orphan commit of dist/ contents only
git worktree prune 2>/dev/null || true
# Remove stale worktree registration if present
git worktree remove --force "$WORKTREE" 2>/dev/null || true
rm -rf "$WORKTREE"

git worktree add --detach "$WORKTREE" HEAD
(
  cd "$WORKTREE"
  # Create orphan branch with no parents
  git checkout --orphan "$BRANCH"
  # Clear the index / tracked files from the detached HEAD tree
  git rm -rf --quiet . 2>/dev/null || true
  # Drop leftovers (keep .git)
  find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

  # Copy build output
  cp -a "$ROOT/dist"/. .

  git add -A
  if git diff --cached --quiet; then
    echo "==> Nothing new to publish (empty tree?)"
    exit 1
  fi

  # Local identity only if missing in this worktree/repo
  AUTHOR_NAME="$(git -C "$ROOT" config user.name 2>/dev/null || echo bot)"
  AUTHOR_EMAIL="$(git -C "$ROOT" config user.email 2>/dev/null || echo bot@tower)"
  git -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" \
    commit -m "publish: gh-pages from $(git -C "$ROOT" rev-parse --short HEAD)"

  echo "==> Pushing orphan ${BRANCH} (force-with-lease)"
  git push --force-with-lease origin "HEAD:refs/heads/${BRANCH}"
)

echo "==> Cleaning worktree"
git worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
git worktree prune 2>/dev/null || true

echo "==> Done. Enable GitHub Pages source: branch ${BRANCH} / (root)."
