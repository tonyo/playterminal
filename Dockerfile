# syntax=docker/dockerfile:1
# PlayTerminal as one nginx image: the static site (site/, built by Astro) and the VM files
# under /v86/ (the VM Image and the Snapshot, built from vm/ and verified in this build).
#
# Build with `docker buildx bake` (docker-bake.hcl): it supplies the `guest` context, the
# i386 VM Image built from vm/image/Dockerfile. A failed vm-verify or site test fails the
# image. The site and VM stages don't depend on each other, so BuildKit builds them in
# parallel, and editing a Game's TOML only re-runs vm-verify and site, not the Snapshot.

ARG NODE_IMAGE=node:24.22.3-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530
ARG PYTHON_IMAGE=python:3.14.10-slim@sha256:22eafb370920ad8b429e0aec3fff433e0669968519f5d60469d83729c138b28b
ARG NGINX_IMAGE=nginx:1.30.7-alpine@sha256:caf4e1e032a20f9c3c5e28fc7f25ffd768ad8677b4975c54193075997b3a97e3

FROM ${NODE_IMAGE} AS node

# ---- VM Image and Snapshot (vm/) ----

# npm v86: the emulator files, and the node API that boots and checks the Snapshot.
FROM node AS vm-npm
WORKDIR /src/vm
COPY vm/package.json vm/package-lock.json ./
RUN npm ci --no-fund --no-audit

# Python for v86's image tools, node for the Snapshot scripts.
FROM ${PYTHON_IMAGE} AS vm-tools
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN pip install --no-cache-dir --root-user-action=ignore zstandard==0.25.0
# The BIOS files and image tools from copy/v86 (BSD-2-Clause) at 315b2b0, the commit npm
# v86@0.5.473 was built from.
ARG V86_RAW=https://raw.githubusercontent.com/copy/v86/315b2b0b758703ef0e6cc7b4088d6068f83f3c20
ADD --chmod=644 --checksum=sha256:73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98 \
    ${V86_RAW}/bios/seabios.bin /src/vm/upstream/
ADD --chmod=644 --checksum=sha256:a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880 \
    ${V86_RAW}/bios/vgabios.bin /src/vm/upstream/
ADD --chmod=644 --checksum=sha256:546b0ce7d0b172fa855587209318a8d473bce6de23fa327ceeb5b6c115fda23f \
    ${V86_RAW}/tools/fs2json.py /src/vm/upstream/
ADD --chmod=644 --checksum=sha256:7bfb94736afbb9753b6deea922184eec2f9b205be0214bc5f9866cf990bfa77c \
    ${V86_RAW}/tools/copy-to-sha256.py /src/vm/upstream/
COPY --from=vm-npm /src/vm/node_modules /src/vm/node_modules
WORKDIR /src/vm

# The guest's files → out/fs.json, out/rootfs-flat/, out/THIRD-PARTY.txt. A bind mount keeps
# owners and modes; convert-image.sh checks that every tar entry reached fs.json.
FROM vm-tools AS vm-image
COPY vm/scripts/convert-image.sh vm/scripts/third-party.py scripts/
RUN --mount=type=bind,from=guest,target=/guest \
    tar -C /guest --numeric-owner -cf /tmp/rootfs.tar $(ls -A /guest) \
    && scripts/convert-image.sh /tmp/rootfs.tar upstream node_modules/v86/LICENSE out \
    && rm /tmp/rootfs.tar

# Cold-boot in node (about 2 minutes), save the Snapshot, name it and fs.json by content hash.
FROM vm-image AS vm-state
COPY vm/config.mjs ./
COPY vm/scripts/build-state.mjs vm/scripts/stamp.mjs scripts/
RUN cp node_modules/v86/build/libv86.js node_modules/v86/build/v86.wasm \
       upstream/seabios.bin upstream/vgabios.bin config.mjs out/ \
    && node scripts/build-state.mjs \
    && node scripts/stamp.mjs

# Restore the Snapshot and check the launcher, robots and every Game's Command.
FROM vm-state AS vm-verify
COPY games/*.toml /src/games/
COPY vm/scripts/verify.mjs scripts/
RUN node scripts/verify.mjs

# The verified VM files alone: `docker buildx bake vm-out` (`mise run vm:build`).
FROM scratch AS vm-out
COPY --from=vm-verify /src/vm/out/ /

# ---- Static site (site/) ----

FROM node AS site
ENV ASTRO_TELEMETRY_DISABLED=1
WORKDIR /src/site
COPY site/package.json site/package-lock.json site/.npmrc ./
RUN npm ci --no-fund --no-audit
COPY games/*.toml /src/games/
COPY site/ ./
RUN npx astro build && node --test

# ---- Served files ----

# gzip the text files next to the originals, for nginx's gzip_static. The Snapshot and
# rootfs-flat/ are zstd already.
FROM node AS compress
COPY --from=site /src/site/dist/ /srv/playterminal/
COPY --from=vm-verify /src/vm/out/ /srv/playterminal/v86/
RUN find /srv/playterminal -path /srv/playterminal/v86/rootfs-flat -prune -o -type f \
      \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' -o -name '*.json' \
         -o -name '*.svg' -o -name '*.txt' -o -name '*.wasm' -o -name '*.bin' \) \
      -exec gzip -9 -k -n {} +

FROM ${NGINX_IMAGE}
COPY nginx/site.conf /etc/nginx/conf.d/default.conf
COPY --link --from=compress /srv/playterminal/ /srv/playterminal/
