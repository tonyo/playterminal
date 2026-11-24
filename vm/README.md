# v86 VM Image

Builds the files PlayTerminal needs to run Games in the visitor's browser with the
[v86](https://github.com/copy/v86) emulator: one i386 Alpine Linux VM Image holding the
Games, and a Snapshot of it booted to a root shell on the serial console (ttyS0). The page
restores the Snapshot and drives the Game over v86's `serial0`.

## Build

Needs [mise](https://mise.jdx.dev) and Docker (the image is built with
`--platform linux/386`).

```sh
mise run build     # clean build of out/, then `mise run verify`
mise run verify    # restore the Snapshot in node; check `echo hi` and `robots` over serial0
mise run serve     # then open http://localhost:8087/test.html (raw serial0 output in a browser)
```

## Output (`out/`)

| File | What |
|---|---|
| `libv86.js`, `v86.wasm` | emulator, from npm `v86@0.5.473` |
| `seabios.bin`, `vgabios.bin` | BIOS files |
| `fs.json`, `rootfs-flat/` | the VM Image as v86 9p-over-HTTP (index + sha256-named zstd blobs, fetched on demand) |
| `state.bin.zst` | the Snapshot |
| `THIRD-PARTY.txt` | licenses and source pointers for the emulator, BIOS files and every Alpine package in the VM Image (`scripts/third-party.py`, from the image's apk database) |
| `config.mjs` | `v86Options(base)` and `snapshotUrl(base)`; the page must use these exact options or the Snapshot won't restore |

Serve `out/` as static files and, in the page:

```js
import { v86Options, snapshotUrl } from "./out/config.mjs";
const emulator = new V86({ ...v86Options("./out/"), initial_state: { url: snapshotUrl("./out/") } });
```

## Sources

- `image/Dockerfile`: v86's `tools/docker/alpine/Dockerfile` with `bsd-games` and `nethack`
  instead of nodejs, and a launcher on ttyS0 (`image/playterminal-launcher`) in place of a login shell.
- The BIOS files and v86's `fs2json.py` / `copy-to-sha256.py` are downloaded from
  [copy/v86](https://github.com/copy/v86) (BSD-2-Clause) at commit `315b2b0`, the source of
  npm `v86@0.5.473`, and checked against pinned sha256 sums (`scripts/fetch-upstream.sh`).
