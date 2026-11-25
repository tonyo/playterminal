# v86 VM Image

Builds the files PlayTerminal needs to run Games in the visitor's browser with the
[v86](https://github.com/copy/v86) emulator: one i386 Alpine Linux VM Image holding the
Games, and a Snapshot of it booted to a root shell on the serial console (ttyS0). The page
restores the Snapshot and drives the Game over v86's `serial0`; it sends the terminal size
on `serial1` (ttyS1) when the window is resized.

This directory came from the playterminal-images repo and is under its MIT license
([LICENSE](LICENSE)); the rest of PlayTerminal is Apache-2.0.

## Build

Needs [mise](https://mise.jdx.dev) and Docker (the image is built with
`--platform linux/386`).

```sh
mise run build     # clean build of out/, then `mise run verify`
mise run verify    # restore the Snapshot in node; check the launcher, `robots`, resizing and
                   # that every Command in ../games/library/*.toml is installed
mise run serve     # then open http://localhost:8087/test.html (raw serial0 output in a browser)
```

CI (`.github/workflows/vm.yml`) runs `mise run build` whenever `vm/` changes and keeps
`out/` as the `vm-out` artifact for 14 days.

## Output (`out/`)

| File | What |
|---|---|
| `libv86.js`, `v86.wasm` | emulator, from npm `v86@0.5.473` |
| `seabios.bin`, `vgabios.bin` | BIOS files |
| `fs-<hash>.json`, `rootfs-flat/` | the VM Image as v86 9p-over-HTTP (index + sha256-named zstd blobs, fetched on demand) |
| `state-<hash>.bin.zst` | the Snapshot |
| `THIRD-PARTY.txt` | licenses and source pointers for the emulator, BIOS files and every Alpine package in the VM Image (`scripts/third-party.py`, from the image's apk database) |
| `config.mjs` | `v86Options(base)` and `snapshotUrl(base)`, which name the files above; the page must use these exact options or the Snapshot won't restore |

Serve `out/` as static files and, in the page:

```js
import { v86Options, snapshotUrl } from "./out/config.mjs";
const emulator = new V86({ ...v86Options("./out/"), initial_state: { url: snapshotUrl("./out/") } });
```

## Sources

- `image/Dockerfile`: v86's `tools/docker/alpine/Dockerfile` with the games instead of nodejs
  (Alpine's `bsd-games`, `nethack`, `micro-tetris` and `words-en`, plus Greed 4.5 built from
  [source](https://gitlab.com/esr/greed) in a separate stage), a launcher on ttyS0 (`image/playterminal-launcher`) in place of a login shell,
  and `image/playterminal-resize` on ttyS1, which sets ttyS0's size.
- The BIOS files and v86's `fs2json.py` / `copy-to-sha256.py` are downloaded from
  [copy/v86](https://github.com/copy/v86) (BSD-2-Clause) at commit `315b2b0`, the source of
  npm `v86@0.5.473`, and checked against pinned sha256 sums (`scripts/fetch-upstream.sh`).
