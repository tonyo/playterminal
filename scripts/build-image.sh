#!/usr/bin/env bash
# Build the Alpine i386 VM Image and convert it to v86's 9p-over-HTTP layout
# (out/fs.json + sha256-named zstd blobs in out/rootfs-flat/).
# Adapted from v86/tools/docker/alpine/build.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=out
TAR="$OUT"/rootfs.tar
FLAT="$OUT"/rootfs-flat
FSJSON="$OUT"/fs.json
CONTAINER=playterminal-v86-image
IMAGE=playterminal/v86-image
TOOLS=.upstream
UVRUN=(uv run --no-project --with zstandard==0.25.0 python)

mkdir -p "$OUT"
docker build image --platform linux/386 --rm --tag "$IMAGE"
docker rm "$CONTAINER" >/dev/null 2>&1 || true
docker create --platform linux/386 --name "$CONTAINER" "$IMAGE" >/dev/null
docker export "$CONTAINER" -o "$TAR"
docker rm "$CONTAINER" >/dev/null
tar -f "$TAR" --delete ".dockerenv" || true

rm -rf "$FLAT" "$FSJSON"
"${UVRUN[@]}" "$TOOLS"/fs2json.py --zstd --out "$FSJSON" "$TAR"
mkdir -p "$FLAT"
"${UVRUN[@]}" "$TOOLS"/copy-to-sha256.py --zstd "$TAR" "$FLAT"
rm "$TAR"

echo "Built $FSJSON and $FLAT ($(du -sh "$FLAT" | cut -f1))"
