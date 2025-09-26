#!/bin/bash

# Docker cleanup script
echo "🧹 Cleaning Docker environment..."

# Stop and remove containers
echo "🛑 Stopping containers..."
docker-compose --profile prod down 2>/dev/null || true
docker-compose down 2>/dev/null || true

# Remove images (preserving base images)
echo "🗑️  Removing images..."
docker-compose --profile prod down --rmi local 2>/dev/null || true

# Remove volumes (optional - uncomment if you want to reset data)
# echo "🗑️  Removing volumes..."
# docker-compose down -v 2>/dev/null || true

# Remove unused images (preserving base images)
echo "🧹 Removing unused images..."
docker image prune -f --filter "until=24h"

# Remove unused networks
echo "🧹 Removing unused networks..."
docker network prune -f

echo "✅ Docker cleanup completed!"
echo ""
echo "🚀 To rebuild and start:"
echo "  npm run start:prod"
