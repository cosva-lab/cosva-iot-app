#!/usr/bin/env bash
# Build dashboard in cosva-iot → recreate dashboard-service.
# For UI-only hot reload use: cd ../cosva-iot && npm run dev:ui
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOT="$(cd "$ROOT/../cosva-iot" && pwd)"
DASHBOARD="$IOT/packages/dashboard"

if [[ ! -d "$DASHBOARD" ]]; then
  echo "Sibling cosva-iot not found at $IOT" >&2
  exit 1
fi

echo "→ Building @cosva-lab/iot-dashboard…"
(cd "$DASHBOARD" && npm run build)

echo "→ Rebuilding & recreating dashboard-service…"
(cd "$ROOT" && docker compose build dashboard-service && \
  docker compose up -d --force-recreate dashboard-service)

PORT="$(grep -E '^DASHBOARD_SERVICE_PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo 3500)"
PORT="${PORT:-3500}"
echo
echo "Done. Parlor: http://localhost:${PORT}"
echo "UI hot reload: cd ../cosva-iot && npm run dev:ui → http://localhost:3001"
