#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for file in app.js planner.mjs cloud-store.mjs firebase-config.json styles.css index.html; do
  if [[ ! -f "$file" ]]; then
    echo "bust-cache: missing $file" >&2
    exit 1
  fi
done

hash_files() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@"
  else
    shasum -a 256 "$@"
  fi
}

HASH=$(
  hash_files app.js planner.mjs cloud-store.mjs firebase-config.json styles.css | hash_files | awk '{print substr($1, 1, 8)}'
)

if grep -q "?v=$HASH\"" index.html; then
  echo "bust-cache: index.html already uses $HASH"
  exit 0
fi

if sed --version >/dev/null 2>&1; then
  sed -i "s/\\?v=[^\"']*/?v=$HASH/g" index.html
else
  sed -i '' "s/\\?v=[^\"']*/?v=$HASH/g" index.html
fi

echo "bust-cache: updated index.html to ?v=$HASH"
