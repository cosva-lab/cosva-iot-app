# Optimized Dockerfile for dashboard service - uses shared base image
FROM cosva-shared-base:latest

WORKDIR /app

# Copy source code
COPY services/dashboard/ ./services/dashboard/

# Install dependencies
WORKDIR /app

RUN npm i

WORKDIR /app/services/dashboard

# Switch to non-root user (after all build operations are complete)
USER nodejs

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]