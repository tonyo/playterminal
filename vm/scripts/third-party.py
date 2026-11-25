"""Write out/THIRD-PARTY.txt: the licenses of the emulator, BIOS files, every Alpine
package in the VM Image and the programs built from source, with where to get their source.

Usage: third-party.py ROOTFS_TAR V86_LICENSE OUT_FILE

The package list comes from the image's apk database (lib/apk/db/installed), so it always
matches what was built.
"""

import sys
import tarfile

ALPINE = "3.21"
V86_COMMIT = "315b2b0b758703ef0e6cc7b4088d6068f83f3c20"
SEABIOS = "rel-1.16.2"
APORTS = "https://gitlab.alpinelinux.org/alpine/aports/-/tree"
# Built from source by image/Dockerfile; keep in step with its GREED_COMMIT.
GREED_COMMIT = "79799d1ba4b1bbc30c13d2b6725ab5ce5dbc5c32"


def installed_packages(tar_path):
    with tarfile.open(tar_path) as tar:
        db = tar.extractfile("lib/apk/db/installed").read().decode()
    packages = []
    for record in db.strip().split("\n\n"):
        fields = {}
        for line in record.splitlines():
            key, _, value = line.partition(":")
            fields.setdefault(key, value)
        packages.append(fields)
    return sorted(packages, key=lambda p: p["P"])


def read_member(tar_path, name):
    with tarfile.open(tar_path) as tar:
        return tar.extractfile(name).read().decode().strip()


def main(tar_path, v86_license_path, out_path):
    packages = installed_packages(tar_path)
    greed_license = read_member(tar_path, "usr/share/licenses/greed/COPYING")
    with open(v86_license_path) as f:
        v86_license = f.read().strip()

    lines = [
        "PlayTerminal: third-party software in the browser VM",
        "=====================================================",
        "",
        "Games run in your browser inside the v86 emulator, on an i386 Alpine Linux image.",
        "These files are served from this directory. Each program keeps its own license;",
        "running it in the emulator does not change the license of anything else.",
        "",
        "The image is built by https://github.com/tonyo/playterminal (vm/).",
        "",
        "",
        "1. v86 emulator (libv86.js, v86.wasm)",
        "-------------------------------------",
        "",
        "npm v86@0.5.473, built from https://github.com/copy/v86/tree/" + V86_COMMIT,
        "License: BSD-2-Clause",
        "",
        v86_license,
        "",
        "",
        "2. BIOS (seabios.bin, vgabios.bin)",
        "----------------------------------",
        "",
        f"SeaBIOS {SEABIOS} and SeaVGABIOS, as built and shipped by v86 in its bios/ directory:",
        f"https://github.com/copy/v86/tree/{V86_COMMIT}/bios",
        "License: LGPL-3.0",
        f"Source: https://github.com/coreboot/seabios/tree/{SEABIOS}",
        "",
        "",
        f"3. Alpine Linux {ALPINE} packages (fs-*.json, rootfs-flat/, state-*.bin.zst)",
        "---------------------------------------------------------------------",
        "",
        "The VM image and its saved state hold these Alpine packages (i386). Each package's",
        "build recipe (APKBUILD) is in Alpine's aports repository at the commit listed, under",
        "main/<origin> or community/<origin>; the APKBUILD names the upstream source archive",
        "and Alpine's patches. Upstream project pages are listed too.",
        "",
    ]
    for p in packages:
        lines += [
            f"{p['P']} {p['V']}",
            f"  License: {p.get('L', 'unknown')}",
            f"  Project: {p.get('U', '-')}",
            f"  Source:  {APORTS}/{p['c']} (origin {p['o']})" if "c" in p else "  Source:  -",
            "",
        ]
    lines += [
        "",
        "4. Programs built from source",
        "-----------------------------",
        "",
        "Greed 4.5 (/usr/bin/greed), by Eric S. Raymond",
        "License: BSD-2-Clause",
        f"Source: https://gitlab.com/esr/greed/-/tree/{GREED_COMMIT}",
        "",
        greed_license,
        "",
        "",
        "5. PlayTerminal's own files in the image",
        "----------------------------------------",
        "",
        "/usr/local/bin/playterminal-launcher and the image build scripts:",
        "MIT, https://github.com/tonyo/playterminal (LICENSE)",
        "",
    ]
    with open(out_path, "w") as f:
        f.write("\n".join(lines))
    print(f"Wrote {out_path} ({len(packages)} Alpine packages)")


if __name__ == "__main__":
    main(*sys.argv[1:])
