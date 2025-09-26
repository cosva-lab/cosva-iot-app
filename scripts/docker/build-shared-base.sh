#!/bin/bash

# Build shared base image script
echo "🔨 Building shared base image..."

# Build the shared base image
docker build -f ./Dockerfile.shared -t cosva-shared-base:latest .

if [ $? -eq 0 ]; then
    echo "✅ Shared base image built successfully!"
    echo "🚀 You can now run: npm run start:prod"
else
    echo "❌ Failed to build shared base image"
    exit 1
fi
