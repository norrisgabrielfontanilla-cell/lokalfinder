#!/usr/bin/env bash
# Collects the annotations of the check run "photo-bundle" on one commit and rebuilds the files they carry.
#   tools/fetch-run.sh COMMIT_SHA OUT_DIR [owner/repo]
set -euo pipefail
SHA="${1:?commit sha}"; OUT="${2:?output dir}"; REPO="${3:-norrisgabrielfontanilla-cell/lokalfinder}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp)"
ID="$(gh api "repos/$REPO/commits/$SHA/check-runs?check_name=photo-bundle&per_page=100" --jq '[.check_runs[] | select(.name=="photo-bundle")] | sort_by(.id) | last | .id')"
[ -n "$ID" ] && [ "$ID" != "null" ] || { echo "no check run named photo-bundle on $SHA" >&2; exit 1; }
echo "check run $ID" >&2
gh api "repos/$REPO/check-runs/$ID/annotations?per_page=100" --paginate > "$TMP"
node "$HERE/reassemble.js" "$TMP" "$OUT"
rm -f "$TMP"
