// Cold-boot the image in node, wait for the root shell, save a zstd snapshot the page
// boots from. Adapted from v86/tools/docker/alpine/build-state.js.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import { V86 } from "v86";
import { v86Options } from "../site/config.mjs";

const site = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../site") + "/";
const out = path.join(site, "images/state.bin");

const t0 = Date.now();
// In node, v86's default wasm path is relative to the cwd; point at the package's copy.
const wasm_path = url.fileURLToPath(import.meta.resolve("v86/build/v86.wasm"));
const emulator = new V86({ ...v86Options(site), wasm_path });
console.log("Booting…");

let serial = "";
let booted = false;
emulator.add_listener("serial0-output-byte", (byte) => {
    serial += String.fromCharCode(byte);
    if (booted || !serial.endsWith("localhost:~# ")) return;
    booted = true;
    console.log(`Shell prompt after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    emulator.serial0_send("sync; echo 3 > /proc/sys/vm/drop_caches\n");
    setTimeout(async () => {
        const state = await emulator.save_state();
        fs.writeFileSync(out, new Uint8Array(state));
        execFileSync("zstd", ["-19", "-f", "-q", "--rm", out]);
        const kb = (n) => (n / 1024).toFixed(0) + " KiB";
        console.log(`Saved ${out}.zst: ${kb(fs.statSync(out + ".zst").size)} (raw ${kb(state.byteLength)})`);
        emulator.destroy();
    }, 5000);
});
