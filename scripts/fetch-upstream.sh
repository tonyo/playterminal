#!/usr/bin/env bash
# Fetch the BIOS files and image tools from copy/v86 (BSD-2-Clause) at 315b2b0, the
# commit npm v86@0.5.473 was built from, and check them against pinned sha256 sums.
set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT=315b2b0b758703ef0e6cc7b4088d6068f83f3c20
BASE=https://raw.githubusercontent.com/copy/v86/$COMMIT
DIR=.upstream

declare -A FILES=(
    [bios/seabios.bin]=73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98
    [bios/vgabios.bin]=a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880
    [tools/fs2json.py]=546b0ce7d0b172fa855587209318a8d473bce6de23fa327ceeb5b6c115fda23f
    [tools/copy-to-sha256.py]=7bfb94736afbb9753b6deea922184eec2f9b205be0214bc5f9866cf990bfa77c
)

mkdir -p "$DIR"
for src in "${!FILES[@]}"; do
    dst="$DIR/$(basename "$src")"
    if [[ -f "$dst" ]] && echo "${FILES[$src]}  $dst" | sha256sum -c --quiet 2>/dev/null; then
        continue
    fi
    curl -fsSL -o "$dst.tmp" "$BASE/$src"
    echo "${FILES[$src]}  $dst.tmp" | sha256sum -c --quiet
    mv "$dst.tmp" "$dst"
done
