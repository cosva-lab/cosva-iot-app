#!/bin/sh
set -e

echo "Initializing Cosva IoT database..."

export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

echo "Waiting for PostgreSQL..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d "${DB_NAME}"; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready"

cd /app

echo "Generating Prisma client from @cosva-lab/iot-db..."
npx prisma generate

echo "Applying migrations..."
npx prisma migrate deploy

if [ -f ./scripts/seed/index.js ]; then
  echo "Seeding database..."
  node ./scripts/seed/index.js || echo "Seed skipped or failed (non-fatal)"
fi

echo "Database initialization complete"
