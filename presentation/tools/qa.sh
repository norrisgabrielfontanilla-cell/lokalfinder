#!/usr/bin/env bash
# build (all slides, or a prefix like "0" / "02") then render for visual QA
set -e
cd "$(dirname "$0")/.."
node build.js "$@"
SK=${SK:-/root/.claude/skills/synced/c5c67c2d-99c1-4bd5-bf83-68fb1f508258_490abb7d-64b3-4685-bf35-a47d78a09464/pptx}
if [ -f "$SK/scripts/office/soffice.py" ]; then export SOFFICE="python3 $SK/scripts/office/soffice.py"; fi
python3 tools/render.py Lokal_Finder_Premium_Presentation.pptx ${DPI:-110}
