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
TOOLS=.upstream
UVRUN=(uv run --no-project --with zstandard==0.25.0 python)

mkdir -p "$OUT"
# BuildKit writes the image's filesystem straight to a tar. Upstream instead runs
# `docker create` + `docker export` + `tar --delete .dockerenv`, but GNU tar's
# --delete corrupts that archive, and fs2json then silently drops every entry
# after the damage (/var/log, /var/tmp, NetHack's sysconf, ...). The export also
# carries Docker's runtime placeholders (an empty /etc/hostname, /etc/resolv.conf).
docker build image --platform linux/386 --output type=tar,dest="$TAR"

rm -rf "$FLAT" "$FSJSON"
"${UVRUN[@]}" "$TOOLS"/fs2json.py --zstd --out "$FSJSON" "$TAR"
# fs2json loses entries without failing; check that every tar entry made it.
python3 -I - "$TAR" "$FSJSON" <<'EOF'
import json, sys, tarfile
names = {m.name.rstrip("/") for m in tarfile.open(sys.argv[1]).getmembers()} - {"", "."}
seen = set()
def walk(nodes, prefix):
    for node in nodes:
        seen.add(prefix + node[0])
        if len(node) > 6 and isinstance(node[6], list):
            walk(node[6], prefix + node[0] + "/")
walk(json.load(open(sys.argv[2]))["fsroot"], "")
missing = sorted(names - seen)
if missing:
    sys.exit(f"fs.json is missing {len(missing)} of {len(names)} tar entries: {missing[:10]}")
print(f"fs.json has all {len(names)} tar entries")
EOF
python3 -I scripts/third-party.py "$TAR" node_modules/v86/LICENSE "$OUT"/THIRD-PARTY.txt
mkdir -p "$FLAT"
"${UVRUN[@]}" "$TOOLS"/copy-to-sha256.py --zstd "$TAR" "$FLAT"
rm "$TAR"

echo "Built $FSJSON and $FLAT ($(du -sh "$FLAT" | cut -f1))"
