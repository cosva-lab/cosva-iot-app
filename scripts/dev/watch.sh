#!/usr/bin/env bash
# Fast local loop: rollup -w in cosva-iot, bind-mounted dist inside the app containers.
# Ctrl+C stops the file watchers. Containers keep running and pick up the next `dev:watch`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOT="$(cd "$ROOT/../cosva-iot" && pwd)"

if [[ ! -d "$IOT/packages/dashboard" ]]; then
  echo "Sibling cosva-iot not found at $IOT" >&2
  exit 1
fi

WATCH_PID=""
LOG_PID=""

cleanup() {
  if [[ -n "$LOG_PID" ]]; then
    kill "$LOG_PID" 2>/dev/null || true
  fi
  if [[ -n "$WATCH_PID" ]]; then
    kill "$WATCH_PID" 2>/dev/null || true
    pkill -P "$WATCH_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

build_pkg() {
  local name="$1"
  echo "→ build $name (no obfuscation)"
  (cd "$IOT/packages/$name" && ROLLUP_OBFUSCATE=0 npx rollup -c)
}

echo "→ Prisma client in cosva-iot (types for the db build)…"
(cd "$IOT" && npm run db:generate --workspace=@cosva-lab/iot-db)

build_pkg shared
build_pkg db
build_pkg dashboard &
build_pkg sensor &
build_pkg sync &
wait

echo "→ Recreating app containers with live mounts…"
(
  cd "$ROOT"
  docker compose up -d postgres mosquitto redis
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate --no-deps \
    dashboard-service sensor-service sync-service
)

PORT="$(grep -E '^DASHBOARD_SERVICE_PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
PORT="${PORT:-3500}"

echo
echo "API / sensor / sync: save in cosva-iot. Rollup rebuilds, the container restarts node."
echo "Parlor (this API):  http://localhost:${PORT}"
echo "Parlor UI hot reload:  cd ../cosva-iot && npm run dev:ui  →  http://localhost:3001"
echo "Ctrl+C stops watchers only. Containers stay up."
echo "New npm dependencies still need: npm run dev:reload:services"
echo

(cd "$IOT" && npm run dev:services) &
WATCH_PID=$!

(cd "$ROOT" && docker compose logs -f --tail=30 dashboard-service sensor-service sync-service) &
LOG_PID=$!

wait "$WATCH_PID"
