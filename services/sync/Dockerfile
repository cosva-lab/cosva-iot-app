# Optimized Dockerfile for sync service - uses shared base image
FROM cosva-shared-base:latest

WORKDIR /app

# Copy source code
COPY services/sync/ ./services/sync/

# Install dependencies
WORKDIR /app

RUN npm i

WORKDIR /app/services/sync

# Switch to non-root user (after all build operations are complete)
USER nodejs

# Start the application
CMD ["npm", "start"]