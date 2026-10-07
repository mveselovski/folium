#!/bin/sh
# Installs the standalone folium binary on Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/mveselovski/folium/main/install.sh | sh
#
# Environment:
#   FOLIUM_VERSION      version to install, e.g. 0.2.0 (default: latest release)
#   FOLIUM_INSTALL_DIR  where to put the binary (default: ~/.local/bin)
set -eu

REPO="mveselovski/folium"
INSTALL_DIR="${FOLIUM_INSTALL_DIR:-$HOME/.local/bin}"

fail() { echo "error: $*" >&2; exit 1; }

if [ "$(uname -s)" != Linux ]; then
  fail "this installer is for Linux. On macOS: brew tap $REPO https://github.com/$REPO && brew trust $REPO && brew install folium"
fi
case "$(uname -m)" in
  x86_64|amd64)  ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac
if ldd --version 2>&1 | grep -i musl >/dev/null; then
  fail "musl-based distributions (e.g. Alpine) aren't supported; the binary needs glibc 2.28+"
fi
command -v curl >/dev/null || fail "curl is required"

if [ -n "${FOLIUM_VERSION:-}" ]; then
  VERSION="${FOLIUM_VERSION#v}"
else
  LATEST="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest")"
  VERSION="${LATEST##*/v}"
fi
NAME="folium-$VERSION-linux-$ARCH"
URL="https://github.com/$REPO/releases/download/v$VERSION/$NAME.tar.gz"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading folium $VERSION ($ARCH)…"
curl -fSL --progress-bar "$URL" -o "$TMP/$NAME.tar.gz" || fail "download failed: $URL"
curl -fsSL "$URL.sha256" -o "$TMP/$NAME.tar.gz.sha256" || fail "checksum download failed"
(cd "$TMP" && sha256sum -c --quiet "$NAME.tar.gz.sha256") || fail "checksum mismatch"

tar -xzf "$TMP/$NAME.tar.gz" -C "$TMP"
mkdir -p "$INSTALL_DIR"
install -m 755 "$TMP/$NAME/folium" "$INSTALL_DIR/folium"
echo "Installed folium $VERSION to $INSTALL_DIR/folium"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) echo "Run: folium ~/Documents" ;;
  *) echo "Add $INSTALL_DIR to your PATH, then run: folium ~/Documents" ;;
esac
