#!/usr/bin/env bash
# Collects the annotations of every job of one workflow run and rebuilds the files they carry.
#   tools/fetch-run.sh RUN_ID OUT_DIR [owner/repo]
set -euo pipefail
RUN="${1:?run id}"; OUT="${2:?output dir}"; REPO="${3:-norrisgabrielfontanilla-cell/lokalfinder}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp)"
for J in $(gh api "repos/$REPO/actions/runs/$RUN/jobs?per_page=100" --jq '.jobs[].id'); do
  gh api "repos/$REPO/check-runs/$J/annotations?per_page=100" --paginate >> "$TMP"
  echo >> "$TMP"
done
node "$HERE/reassemble.js" "$TMP" "$OUT"
rm -f "$TMP"
