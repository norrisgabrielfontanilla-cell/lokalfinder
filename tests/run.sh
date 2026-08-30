#!/usr/bin/env bash
# Lokal Finder test suite.
#
#   cd tests && npm install && ./run.sh
#
# Every test drives the REAL index.html in a headless browser, with the Firebase
# Realtime Database stubbed in memory. Nothing here ever touches production data
# — see harness.js. Do not "fix" a test by pointing it at the live FB_URL.
set -uo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "First run: installing playwright…"
  npm install --silent || { echo "npm install failed"; exit 1; }
fi

fail=0
for t in test-food.js test-cleaning.js test-cross.js test-security.js test-smoke.js test-orderfail.js; do
  node "$t"
  status=$?
  [ $status -ne 0 ] && fail=1
  echo
done

if [ $fail -ne 0 ]; then
  echo "SUITE FAILED"
  exit 1
fi
echo "ALL SUITES PASSED"
