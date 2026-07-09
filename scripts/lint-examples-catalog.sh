#!/usr/bin/env bash
# Compare examples catalog count with README inventories in source repos.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

count_readme_rows() {
  local file="$1"
  grep -cE '^\| \[[^]]+\]\(' "$file" || true
}

PRAXIS_README="${PRAXIS_EXAMPLES_README:-../praxis/examples/README.md}"
AI_README="${AI_EXAMPLES_README:-../ai/examples/README.md}"

if [[ ! -f "$PRAXIS_README" || ! -f "$AI_README" ]]; then
  echo "skip: praxis or ai examples README not found (set PRAXIS_EXAMPLES_README / AI_EXAMPLES_README)" >&2
  exit 0
fi

readme_total=$(( $(count_readme_rows "$PRAXIS_README") + $(count_readme_rows "$AI_README") ))
catalog_total=$(grep -cE "path: '" src/data/examples.ts)

echo "README rows: $readme_total"
echo "examples.ts entries: $catalog_total"

if [[ "$readme_total" -ne "$catalog_total" ]]; then
  echo "examples catalog drift: expected $readme_total entries, found $catalog_total" >&2
  exit 1
fi

echo "examples catalog matches README inventories"
