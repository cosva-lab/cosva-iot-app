#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOT_PACKAGES="$(cd "$ROOT/../cosva-iot/packages" && pwd)"
VENDOR="$ROOT/vendor/@cosva-lab"

echo "Vendoring @cosva-lab packages from $IOT_PACKAGES"

mkdir -p "$VENDOR"
for name in shared db sensor sync dashboard; do
  src="$IOT_PACKAGES/$name"
  dest="$VENDOR/iot-$name"
  rm -rf "$dest"
  mkdir -p "$dest"
  # Package metadata + built dist (+ prisma for db)
  # Strip lifecycle scripts that need the monorepo toolchain (rollup, etc.)
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$src/package.json', 'utf8'));
    for (const key of ['prepare', 'prebuild', 'build', 'dev', 'prerelease', 'release', 'postbuild', 'prepublishOnly']) {
      delete pkg.scripts?.[key];
    }
    fs.writeFileSync('$dest/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  if [ -d "$src/dist" ]; then
    cp -R "$src/dist" "$dest/"
  else
    echo "Missing dist for $name — run npm run build in cosva-iot first" >&2
    exit 1
  fi
  if [ -d "$src/prisma" ]; then
    cp -R "$src/prisma" "$dest/"
  fi
  echo "  vendored iot-$name"
done

echo "Done. Docker can install from vendor/@cosva-lab/*"
