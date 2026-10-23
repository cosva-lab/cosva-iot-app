#!/usr/bin/env bash
# First boot and updates. Drops images built by this project, rebuilds them
# from the current package.json, and starts that result.
# Postgres, Redis, and animal-image volumes are kept.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "→ Lockfile matches package.json"
npm install

echo "→ Stopping the stack and removing images this compose file built"
docker compose down --rmi local --remove-orphans

echo "→ Removing the previous shared base image"
docker image rm cosva-shared-base:latest >/dev/null 2>&1 || true

echo "→ Building cosva-shared-base (no cache)"
docker build --no-cache -f ./Dockerfile.shared -t cosva-shared-base:latest .

echo "→ Building service images (no cache)"
docker compose build --no-cache

echo "→ Starting the stack"
docker compose up -d --force-recreate

echo "→ Waiting for Postgres"
ready=0
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${DB_USERNAME:-cosva_user}" -d "${DB_NAME:-cosva_iot}" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != "1" ]]; then
  echo "Postgres did not become ready." >&2
  exit 1
fi

echo "→ Applying database migrations"
npm run db:migrate

echo "→ Removing dangling layers left by the old builds"
docker image prune -f

PORT="$(grep -E '^DASHBOARD_SERVICE_PORT=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
PORT="${PORT:-3500}"

echo
echo "Done. These images are the ones running."
echo "Parlor: http://localhost:${PORT}"
echo "Versions: curl -s http://localhost:${PORT}/health"
