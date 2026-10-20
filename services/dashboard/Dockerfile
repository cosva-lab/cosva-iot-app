# Optimized Dockerfile for dashboard service - uses shared base image
FROM cosva-shared-base:latest

# Drop privileges after fixing volume ownership (named volumes mount as root).
RUN apk add --no-cache su-exec

WORKDIR /app

# Copy source code + vendored packages (file: deps)
COPY vendor/ ./vendor/
COPY services/dashboard/ ./services/dashboard/
COPY services/dashboard/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /data/animal-images \
  && chown -R nodejs:nodejs /data/animal-images

# Install dependencies
WORKDIR /app

RUN npm i && npx prisma generate \
  && chown -R nodejs:nodejs /app

WORKDIR /app/services/dashboard

# Stay root for entrypoint chown of the animal_images volume, then su-exec → nodejs.
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
