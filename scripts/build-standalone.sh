#!/usr/bin/env bash
# Builds a standalone folium binary (Node.js single executable application) for
# the Linux machine it runs on, and packages it as dist/folium-<version>-linux-<arch>.tar.gz.
#
# Usage: scripts/build-standalone.sh   (after npm ci; uses the node on PATH)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$ROOT/build/standalone"
DIST="$ROOT/dist"
VERSION="$(node -p "require('$ROOT/package.json').version")"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

[[ "$(uname -s)" == Linux ]] || { echo "error: run this on Linux" >&2; exit 1; }
case "$(uname -m)" in
  x86_64)        ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "error: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac
NAME="folium-$VERSION-linux-$ARCH"

rm -rf "$WORK" && mkdir -p "$WORK" "$DIST"

echo "==> Bundling folium.js"
npx --no-install esbuild "$ROOT/folium.js" --bundle --platform=node --target="node$NODE_MAJOR" \
  --format=cjs --legal-comments=none --log-level=warning --outfile="$WORK/folium.cjs"

echo "==> Building single executable (Node $(node --version), $ARCH)"
cat > "$WORK/sea-config.json" <<JSON
{
  "main": "$WORK/folium.cjs",
  "output": "$WORK/sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useCodeCache": false
}
JSON
node --experimental-sea-config "$WORK/sea-config.json"
cp "$(command -v node)" "$WORK/folium"
chmod u+w "$WORK/folium"
npx --no-install postject "$WORK/folium" NODE_SEA_BLOB "$WORK/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo "==> Checking the binary"
[[ "$("$WORK/folium" --version)" == "$VERSION" ]] || { echo "error: --version mismatch" >&2; exit 1; }

echo "==> Packaging $NAME.tar.gz"
mkdir -p "$WORK/$NAME"
cp "$WORK/folium" "$ROOT/LICENSE" "$ROOT/README.md" "$WORK/$NAME/"
tar -czf "$DIST/$NAME.tar.gz" -C "$WORK" "$NAME"
(cd "$DIST" && sha256sum "$NAME.tar.gz" > "$NAME.tar.gz.sha256")
ls -lh "$DIST/$NAME.tar.gz"
