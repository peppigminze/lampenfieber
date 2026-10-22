#!/bin/sh
# Starts a dev server, runs the browser smoke test, stops the server.
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8765 >/tmp/http.log 2>&1 &
PID=$!
sleep 1
python3 tools/smoke.py http://localhost:8765/index.html "${1:-/tmp/shots}" "$2"
kill $PID
