#!/usr/bin/env bash
# Local keep-alive supervisor for the parser service (containers without
# systemd — this dev box runs s6, not systemd). Restarts uvicorn if it exits.
# On the Hostinger VPS use deploy/analyzit-parser.service instead.
#
# Usage (backgrounded by the harness):
#   services/parser/supervise.sh
set -uo pipefail

cd "$(dirname "$0")"
LOG=/tmp/az_parser.log

while true; do
  echo "[supervise $(date -u +%FT%TZ)] starting parser" >> "$LOG"
  ./run.sh >> "$LOG" 2>&1
  code=$?
  echo "[supervise $(date -u +%FT%TZ)] parser exited code=$code, restarting in 2s" >> "$LOG"
  sleep 2
done
