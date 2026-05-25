#!/usr/bin/env bash
# folium.sh — build & run Folium in Docker
#
# Usage:
#   ./folium.sh                        # mounts $HOME, pick folder in browser
#   ./folium.sh ~/Documents            # mounts ~/Documents, opens it directly
#   ./folium.sh ~/Documents --port 8080

set -e

IMAGE_NAME="folium"
HOST_PORT=3000
MOUNT_DIR="$HOME"
OPEN_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) HOST_PORT="$2"; shift 2 ;;
    --port=*) HOST_PORT="${1#*=}"; shift ;;
    -*) shift ;;
    *)
      if [[ -z "$OPEN_DIR" ]]; then
        OPEN_DIR="$(cd "$1" && pwd)"
        MOUNT_DIR="$OPEN_DIR"
      fi
      shift ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "  Building Docker image '$IMAGE_NAME'..."
  docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"
else
  echo "  Using existing Docker image '$IMAGE_NAME'."
  echo "  (To rebuild: docker rmi $IMAGE_NAME)"
fi

DOCKER_ARGS=(
  --rm
  -p "${HOST_PORT}:3000"
  -v "${MOUNT_DIR}:/mnt/host:ro"
)

NODE_ARGS=()
if [[ -n "$OPEN_DIR" ]]; then
  REL="${OPEN_DIR#$MOUNT_DIR}"
  CONTAINER_PATH="/mnt/host${REL}"
  NODE_ARGS+=("$CONTAINER_PATH")
fi

NODE_ARGS+=("--port" "3000")

echo ""
echo "  folium → http://localhost:${HOST_PORT}"
echo "  Host path mounted at /mnt/host (read-only)"
[[ -n "$OPEN_DIR" ]] && echo "  Opening: $OPEN_DIR"
echo "  Press Ctrl+C to stop."
echo ""

docker run "${DOCKER_ARGS[@]}" "$IMAGE_NAME" node folium.js "${NODE_ARGS[@]}"
