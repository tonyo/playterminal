# v86 VM Image

Builds the files PlayTerminal needs to run Games in the visitor's browser with the
[v86](https://github.com/copy/v86) emulator: one i386 Alpine Linux VM Image holding the
Games, and a Snapshot of it booted to a root shell on the serial console (ttyS0). The page
restores the Snapshot and drives the Game over v86's `serial0`; it sends the terminal size
on `serial1` (ttyS1) when the window is resized.

This directory came from the playterminal-images repo. Like the rest of PlayTerminal, it is
under the MIT license ([LICENSE](../LICENSE)).

## Build

Needs [mise](https://mise.jdx.dev) and Docker with buildx; the tasks are in the root
`mise.toml` and run from anywhere in the repository. The build runs in Docker: the
`vm-*` stages of the root [`Dockerfile`](../Dockerfile), wired up by
[`docker-bake.hcl`](../docker-bake.hcl). The same stages go into the site's image, so the
image always carries a verified VM build.

```sh
mise run vm:build     # build and verify in Docker, then write the result to out/
mise run vm:verify    # restore out/'s Snapshot in node; check the launcher, `robots`, resizing
                      # and that every Command in ../games/*.toml is installed
```

The stages, in order:

| Stage | What |
|---|---|
| `guest` (`image/Dockerfile`, linux/386) | the VM Image: Alpine, the Games, the launcher |
| `vm-image` | tars the guest's files and runs `scripts/convert-image.sh`: `fs.json`, `rootfs-flat/`, `THIRD-PARTY.txt` |
| `vm-state` | `scripts/build-state.mjs` cold-boots it in node and saves the Snapshot; `scripts/stamp.mjs` names files by hash |
| `vm-verify` | `scripts/verify.mjs` (also `mise run vm:verify`) |

Only `vm-verify` reads the Games, so editing a Game's TOML doesn't rebuild the Snapshot. CI
builds the whole image on every push, with the stages cached.

## Output (`out/`)

| File | What |
|---|---|
| `libv86-<hash>.js`, `v86-<hash>.wasm` | emulator, from npm `v86@0.5.473` |
| `seabios-<hash>.bin`, `vgabios-<hash>.bin` | BIOS files |
| `fs-<hash>.json`, `rootfs-flat/` | the VM Image as v86 9p-over-HTTP (index + sha256-named zstd blobs, fetched on demand) |
| `state-<hash>.bin.zst` | the Snapshot |
| `THIRD-PARTY.txt` | licenses and source pointers for the emulator, BIOS files and every Alpine package in the VM Image (`scripts/third-party.py`, from the image's apk database) |
| `config.mjs` | `v86Options(base)`, `snapshotUrl(base)` and `libv86Url(base)`, which name the files above; the page must use these exact options or the Snapshot won't restore |

Serve `out/` as static files and, in the page, load the script at `libv86Url("./out/")`
(it defines `V86`), then:

```js
import { v86Options, snapshotUrl } from "./out/config.mjs";
const emulator = new V86({ ...v86Options("./out/"), initial_state: { url: snapshotUrl("./out/") } });
```

## Sources

- `image/Dockerfile`: v86's `tools/docker/alpine/Dockerfile` with the games instead of nodejs
  (Alpine's `bsd-games`, `nethack` and `words-en`, plus Greed 4.5 built from
  [source](https://gitlab.com/esr/greed) and Micro Tetris 1.4.0 built from
  [source](https://github.com/troglobit/tetris) with `image/micro-tetris-timer.patch`, each in
  its own stage), a launcher on ttyS0 (`image/playterminal-launcher`) in place of a login shell,
  and `image/playterminal-resize` on ttyS1, which sets ttyS0's size.
- The BIOS files and v86's `fs2json.py` / `copy-to-sha256.py` are downloaded from
  [copy/v86](https://github.com/copy/v86) (BSD-2-Clause) at commit `315b2b0`, the source of
  npm `v86@0.5.473`, and checked against pinned sha256 sums (`ADD --checksum` in the root `Dockerfile`).
