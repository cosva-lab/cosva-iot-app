#!/bin/sh
set -e

# Named volumes are created as root; the app runs as nodejs (uid 1001).
IMG_DIR="${ANIMAL_IMAGES_DIR:-/data/animal-images}"
mkdir -p "$IMG_DIR"
chown -R nodejs:nodejs "$IMG_DIR"

exec su-exec nodejs "$@"
