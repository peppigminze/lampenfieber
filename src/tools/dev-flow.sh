#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8765 >/tmp/http.log 2>&1 &
PID=$!; sleep 1
python3 tools/flow.py http://localhost:8765/index.html "${1:-/tmp/flow}"
kill $PID
