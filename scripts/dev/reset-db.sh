#!/usr/bin/env bash
# Wipe Cosva IoT local Postgres (and related volumes) and bring the stack back up.
# Safe for pre-production: there is no field data to preserve.
set -euo pipefail
cd "$(dirname "$0")/../.."


echo "→ Stopping stack and removing volumes (postgres, redis, animal images)…"
docker compose down -v --remove-orphans

echo "→ Starting postgres + mosquitto…"
docker compose up -d postgres mosquitto

echo "→ Waiting for postgres…"
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${DB_USERNAME:-cosva_user}" -d "${DB_NAME:-cosva_iot}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "→ Rebuilding init-db (so new Prisma migrations are included)…"
docker compose build init-db

echo "→ Running migrations (init-db)…"
docker compose run --rm init-db

echo "→ Starting app services…"
docker compose up -d --build dashboard-service sensor-service sync-service

echo ""
echo "Done. Database is empty (schema only)."
echo "  Parlor: http://localhost:3500"
echo "  Next: open the UI → Sincronizar animales (pulls herd + today's Cosva productions)."
