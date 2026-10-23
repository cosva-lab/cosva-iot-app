#!/usr/bin/env bash
# Rebuild packages in cosva-iot → migrate → recreate app services.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOT="$(cd "$ROOT/../cosva-iot" && pwd)"

WITH_SENSOR=1
WITH_SYNC=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dashboard-only)
      WITH_SENSOR=0
      WITH_SYNC=0
      shift
      ;;
    *)
      echo "Usage: $0 [--dashboard-only]" >&2
      exit 1
      ;;
  esac
done

echo "→ Building packages in cosva-iot…"
(cd "$IOT/packages/shared" && npm run build)
(cd "$IOT/packages/db" && npm run db:generate && npm run build)
(cd "$IOT/packages/dashboard" && npm run build)
if [[ "$WITH_SENSOR" == "1" ]]; then
  (cd "$IOT/packages/sensor" && npm run build)
fi
if [[ "$WITH_SYNC" == "1" ]]; then
  (cd "$IOT/packages/sync" && npm run build)
fi

echo "→ Migrating DB…"
(cd "$ROOT" && npm run db:migrate)

echo "→ Rebuilding shared base image…"
(cd "$ROOT" && npm run build:shared)

SERVICES=(dashboard-service)
[[ "$WITH_SENSOR" == "1" ]] && SERVICES+=(sensor-service)
[[ "$WITH_SYNC" == "1" ]] && SERVICES+=(sync-service)

echo "→ Docker build + recreate: ${SERVICES[*]}"
(cd "$ROOT" && docker compose build "${SERVICES[@]}" && \
  docker compose up -d --force-recreate "${SERVICES[@]}")

PORT="$(grep -E '^DASHBOARD_SERVICE_PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo 3500)"
echo
echo "Done. Parlor: http://localhost:${PORT:-3500}"
