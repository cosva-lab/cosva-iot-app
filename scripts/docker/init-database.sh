#!/bin/sh

# Database initialization script for Docker
echo "🚀 Initializing database..."


export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
echo "🔧 Built DATABASE_URL: postgresql://${DB_USERNAME}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USERNAME} -d ${DB_NAME}; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd /app/shared
npm run db:generate

# Run database migrations
echo "📊 Running database migrations..."
npm run db:migrate

# Seed the database (optional)
echo "🌱 Seeding database..."
npm run db:seed

echo "🎉 Database initialization complete!"

