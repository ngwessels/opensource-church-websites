#!/usr/bin/env sh
set -e

cd "$(dirname "$0")/.."

# Stop anything on port 3000 so .next can be fully removed
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

rm -rf .next
rm -rf node_modules/.cache

echo "Cache cleared. Starting dev server (webpack)…"
exec npx next dev --webpack
