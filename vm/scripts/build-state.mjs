// Cold-boot out/ in node, wait for the PlayTerminal launcher to be ready on the serial
// console (ttyS0), let it go quiet, and save the zstd Snapshot the page restores. Games are
// launched over serial0, so the Snapshot must sit at the launcher waiting for its line.
// Adapted from v86/tools/docker/alpine/build-state.js.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import { V86 } from "v86";

const out = `${path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../out")}/`;
const { v86Options, snapshotUrl, READY } = await import(path.join(out, "config.mjs"));
const target = snapshotUrl(out);

const QUIET_MS = 3000;
const TIMEOUT_MS = 180_000;

const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const emulator = new V86(v86Options(out));
console.log("Booting…");

let serial = "";
let lastByte = Date.now();
emulator.add_listener("serial0-output-byte", (byte) => {
  serial += String.fromCharCode(byte);
  lastByte = Date.now();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(cond, what) {
  while (!cond()) {
    if (Date.now() - t0 > TIMEOUT_MS) throw new Error(`Timed out waiting for ${what}`);
    await sleep(100);
  }
}

await until(() => serial.endsWith(READY), "the launcher on ttyS0");
console.log(`ttyS0 launcher ready after ${secs()}`);
await until(() => Date.now() - lastByte >= QUIET_MS, "ttyS0 to go quiet");
if (!serial.endsWith(READY)) throw new Error("ttyS0 printed more after the launcher was ready");
console.log(`ttyS0 quiet at the launcher after ${secs()}`);

const state = new Uint8Array(await emulator.save_state());
const zst = zlib.zstdCompressSync(state, {
  params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
});
fs.writeFileSync(target, zst);
const kb = (n) => `${(n / 1024).toFixed(0)} KiB`;
console.log(`Saved ${target}: ${kb(zst.length)} (raw ${kb(state.byteLength)})`);
console.log("Last ttyS0 output:", JSON.stringify(serial.slice(-120)));
emulator.destroy();
process.exit(0);
