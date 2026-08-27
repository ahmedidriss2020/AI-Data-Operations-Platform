#!/usr/bin/env bash
# Run the AnalyzeIt parser/agent service.
# Loads services/parser/.env, then execs uvicorn. Used by both the local
# supervisor (supervise.sh) and, on the VPS, invoked via the systemd unit's venv.
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${PORT:-8100}"
exec venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
