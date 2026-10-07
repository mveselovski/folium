#!/usr/bin/env bash
# Builds Folium.app, signs it with your Developer ID, notarizes it and packages a .dmg per architecture.
# The Homebrew cask in mveselovski/homebrew-tap picks up the dmgs once they're on the GitHub release.
#
# Usage:
#   macos/build.sh                 # arm64 + x64, signed and notarized
#   ARCHS=arm64 macos/build.sh     # one architecture
#   SKIP_NOTARIZE=1 macos/build.sh # sign only (faster, for local testing)
#
# One-time setup:
#   1. Xcode → Settings → Accounts → Manage Certificates → + → "Developer ID Application"
#   2. xcrun notarytool store-credentials folium-notary --apple-id <you@example.com> --team-id <TEAMID>
#      (uses an app-specific password from appleid.apple.com)
#
# Environment overrides:
#   CODESIGN_IDENTITY   defaults to the first "Developer ID Application" identity; "-" for ad-hoc
#   NOTARY_PROFILE      notarytool keychain profile name (default: folium-notary)
#   NODE_VERSION        bundled Node.js version
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS="$ROOT/macos"
BUILD="$ROOT/build/macos"
DIST="$ROOT/dist"
CACHE="$ROOT/build/cache"

NODE_VERSION="${NODE_VERSION:-24.21.0}"
ARCHS="${ARCHS:-arm64 x64}"
NOTARY_PROFILE="${NOTARY_PROFILE:-folium-notary}"
VERSION="$(node -p "require('$ROOT/package.json').version")"
BUILD_NUMBER="$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1)"

if [[ -z "${CODESIGN_IDENTITY:-}" ]]; then
  CODESIGN_IDENTITY="$(security find-identity -v -p codesigning \
    | sed -n 's/.*"\(Developer ID Application: .*\)"/\1/p' | head -1)"
fi
if [[ -z "$CODESIGN_IDENTITY" || "$CODESIGN_IDENTITY" == "-" ]]; then
  echo "warning: no Developer ID Application certificate found — ad-hoc signing, skipping notarization" >&2
  CODESIGN_IDENTITY="-"
  SKIP_NOTARIZE=1
fi

log() { printf '\n==> %s\n' "$*"; }

sign() {
  local args=(--force --options runtime -s "$CODESIGN_IDENTITY")
  [[ "$CODESIGN_IDENTITY" != "-" ]] && args+=(--timestamp)
  codesign "${args[@]}" "$@"
}

rm -rf "$BUILD"
mkdir -p "$BUILD" "$DIST" "$CACHE"

log "Rendering icon"
swift "$MACOS/Icon/make-icon.swift" "$BUILD/AppIcon.iconset"
iconutil -c icns "$BUILD/AppIcon.iconset" -o "$BUILD/AppIcon.icns"

log "Installing server dependencies"
mkdir -p "$BUILD/server"
cp "$ROOT/folium.js" "$ROOT/package.json" "$BUILD/server/"
(cd "$BUILD/server" && npm install --omit=dev --no-package-lock --no-audit --no-fund --loglevel=error)

curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" -o "$CACHE/SHASUMS256-$NODE_VERSION.txt"

for ARCH in $ARCHS; do
  case "$ARCH" in
    arm64) SWIFT_ARCH=arm64 ;;
    x64)   SWIFT_ARCH=x86_64 ;;
    *) echo "unknown arch: $ARCH" >&2; exit 1 ;;
  esac

  log "[$ARCH] Fetching Node.js $NODE_VERSION"
  NODE_TGZ="node-v$NODE_VERSION-darwin-$ARCH.tar.gz"
  [[ -f "$CACHE/$NODE_TGZ" ]] || curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$NODE_TGZ" -o "$CACHE/$NODE_TGZ"
  (cd "$CACHE" && grep " $NODE_TGZ\$" "SHASUMS256-$NODE_VERSION.txt" | shasum -a 256 -c -)

  log "[$ARCH] Building Swift app"
  swift build -c release --arch "$SWIFT_ARCH" --package-path "$MACOS"
  BIN_DIR="$(swift build -c release --arch "$SWIFT_ARCH" --package-path "$MACOS" --show-bin-path)"

  log "[$ARCH] Assembling Folium.app"
  APP="$BUILD/$ARCH/Folium.app"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Helpers" "$APP/Contents/Resources"
  cp "$BIN_DIR/Folium" "$APP/Contents/MacOS/Folium"
  tar -xzf "$CACHE/$NODE_TGZ" -C "$BUILD/$ARCH" "node-v$NODE_VERSION-darwin-$ARCH/bin/node"
  mv "$BUILD/$ARCH/node-v$NODE_VERSION-darwin-$ARCH/bin/node" "$APP/Contents/Helpers/node"
  cp -R "$BUILD/server" "$APP/Contents/Resources/server"
  cp "$BUILD/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
  sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD_NUMBER/" "$MACOS/Info.plist" > "$APP/Contents/Info.plist"

  log "[$ARCH] Signing ($CODESIGN_IDENTITY)"
  sign --entitlements "$MACOS/node.entitlements" "$APP/Contents/Helpers/node"
  sign "$APP"
  codesign --verify --strict --deep --verbose=2 "$APP"

  log "[$ARCH] Packaging dmg"
  DMG="$DIST/Folium-$VERSION-$ARCH.dmg"
  STAGE="$BUILD/$ARCH/dmg"
  mkdir -p "$STAGE"
  cp -R "$APP" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  rm -f "$DMG"
  hdiutil create -quiet -volname "Folium" -srcfolder "$STAGE" -fs HFS+ -format ULMO "$DMG"
  [[ "$CODESIGN_IDENTITY" != "-" ]] && codesign --force --timestamp -s "$CODESIGN_IDENTITY" "$DMG"

  if [[ -z "${SKIP_NOTARIZE:-}" ]]; then
    log "[$ARCH] Notarizing (this takes a few minutes)"
    xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG"
    spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG"
  fi
done

log "Done"
ls -lh "$DIST"/Folium-"$VERSION"-*.dmg
cat <<MSG

Next: upload to the v$VERSION release; the Homebrew cask updates itself within the hour:
  gh release upload v$VERSION $(for a in $ARCHS; do printf '%s ' "dist/Folium-$VERSION-$a.dmg"; done)
MSG
