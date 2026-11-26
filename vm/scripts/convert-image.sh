#!/usr/bin/env bash
# Convert the VM Image's root filesystem (a tar) to v86's 9p-over-HTTP layout: OUT/fs.json,
# sha256-named zstd blobs in OUT/rootfs-flat/, and OUT/THIRD-PARTY.txt.
# Run by the vm-image stage of ../../Dockerfile.
#
# Usage: convert-image.sh ROOTFS_TAR TOOLS_DIR V86_LICENSE OUT
# TOOLS_DIR holds v86's fs2json.py and copy-to-sha256.py; python3 needs `zstandard`.
#
# Adapted from v86/tools/docker/alpine/build.sh. Upstream makes the tar with `docker export`
# + `tar --delete .dockerenv`, but GNU tar's --delete corrupts that archive, and fs2json then
# silently drops every entry after the damage (/var/log, /var/tmp, NetHack's sysconf, ...).
# The Dockerfile instead tars the guest stage's files from a bind mount.
set -euo pipefail

TAR=$1
TOOLS=$2
V86_LICENSE=$3
OUT=$4
FLAT="$OUT"/rootfs-flat
FSJSON="$OUT"/fs.json

mkdir -p "$OUT"
rm -rf "$FLAT" "$FSJSON"
python3 "$TOOLS"/fs2json.py --zstd --out "$FSJSON" "$TAR"
# fs2json loses entries without failing; check that every tar entry made it.
python3 -I - "$TAR" "$FSJSON" <<'PY'
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
PY
python3 -I "$(dirname "$0")"/third-party.py "$TAR" "$V86_LICENSE" "$OUT"/THIRD-PARTY.txt
mkdir -p "$FLAT"
python3 "$TOOLS"/copy-to-sha256.py --zstd "$TAR" "$FLAT"

echo "Built $FSJSON and $FLAT ($(du -sh "$FLAT" | cut -f1))"
