#!/bin/sh
# Rebuilds docs/roadmap/INDEX.md from step-index-head.md + step-index-src.py + coverage.py + the step files (../steps),
# then checks that INDEX.md lists exactly the step files' '### S-xxx · ' headings in a dependency-safe order.
# Layout: this file lives in docs/roadmap/tools/ (research copy: docs-roadmap/tools/).
cd "$(dirname "$0")" || exit 1
python3 step-index-src.py check >&2 || { echo "build-step-index: fix the problems above first" >&2; exit 1; }
python3 build-index.py && python3 build-index.py --check
