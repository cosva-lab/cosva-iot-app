# Optimized Dockerfile for sensor service - uses shared base image
FROM cosva-shared-base:latest

# Install system dependencies for serial port access (must be done as root)
RUN apk add --no-cache \
    udev \
    usbutils \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy source code
COPY services/sensor/ ./services/sensor/

# Install dependencies
WORKDIR /app

RUN npm i

WORKDIR /app/services/sensor

# Switch to non-root user (after all root operations are complete)
USER nodejs

# Expose port (if needed)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]