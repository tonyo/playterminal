#!/usr/bin/env bash
# Build the Alpine games rootfs and convert it to v86's 9p-over-HTTP layout.
# Adapted from v86/tools/docker/alpine/build.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGES=site/images
TAR="$IMAGES"/rootfs.tar
FLAT="$IMAGES"/rootfs-flat
FSJSON="$IMAGES"/fs.json
CONTAINER=alpine-games-v86
IMAGE=i386/alpine-games-v86

mkdir -p "$IMAGES"
docker build alpine-games --platform linux/386 --rm --tag "$IMAGE"
docker rm "$CONTAINER" >/dev/null 2>&1 || true
docker create --platform linux/386 --name "$CONTAINER" "$IMAGE" >/dev/null
docker export "$CONTAINER" -o "$TAR"
docker rm "$CONTAINER" >/dev/null
tar -f "$TAR" --delete ".dockerenv" || true

rm -rf "$FLAT" "$FSJSON"
uv run --no-project --with zstandard python v86/tools/fs2json.py --zstd --out "$FSJSON" "$TAR"
mkdir -p "$FLAT"
uv run --no-project --with zstandard python v86/tools/copy-to-sha256.py --zstd "$TAR" "$FLAT"
rm "$TAR"

echo "Built $FSJSON and $FLAT ($(du -sh "$FLAT" | cut -f1))"
