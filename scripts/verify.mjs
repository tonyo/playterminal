// Restore out/state.bin.zst in node and check, over serial0 only:
//  1. `echo hi` echoes, prints "hi" and returns to the prompt;
//  2. `robots` starts and draws its board with ANSI escapes.
// Exits non-zero on failure.
import path from "node:path";
import url from "node:url";
import { V86 } from "v86";

const out = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../out") + "/";
const { v86Options, snapshotUrl } = await import(path.join(out, "config.mjs"));

const PROMPT = /localhost:~# (\x1b\[6n)?$/;
const TIMEOUT_MS = 30_000;
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(2) + " s";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const emulator = new V86({ ...v86Options(out), initial_state: { url: snapshotUrl(out) } });

let serial = "";
emulator.add_listener("serial0-output-byte", (b) => { serial += String.fromCharCode(b); });

async function until(cond, what) {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > TIMEOUT_MS) {
            console.error(`FAIL: timed out waiting for ${what}. ttyS0 so far:`, JSON.stringify(serial));
            process.exit(1);
        }
        await sleep(50);
    }
}
async function run(cmd) {
    const mark = serial.length;
    emulator.serial0_send(cmd + "\n");
    await until(() => serial.length > mark && PROMPT.test(serial), `prompt after ${JSON.stringify(cmd)}`);
    await sleep(200); // let a trailing ESC[6n arrive
    return serial.slice(mark);
}

await new Promise((r) => emulator.add_listener("emulator-ready", r));
console.log(`Snapshot restored, emulator ready at ${secs()}`);
await sleep(500);
if (serial !== "") {
    console.error("FAIL: ttyS0 not quiet after restore:", JSON.stringify(serial));
    process.exit(1);
}
console.log("ttyS0 quiet after restore: ok");

const hi = await run("echo hi");
console.log(`echo hi -> ${JSON.stringify(hi)} at ${secs()}`);
if (!/^echo hi\r\nhi\r\nlocalhost:~# (\x1b\[6n)?$/.test(hi)) {
    console.error("FAIL: unexpected echo hi output");
    process.exit(1);
}

console.log("tty / TERM / stty:", JSON.stringify(await run("tty; echo TERM=$TERM; stty -a")));

const mark = serial.length;
emulator.serial0_send("stty rows 24 cols 80; clear; exec robots\n");
await until(() => {
    const s = serial.slice(mark);
    return s.includes("\x1b[") && s.includes("@") && s.includes("+") && s.length > 500;
}, "robots to draw");
await sleep(1000);
const drawn = serial.slice(mark);
console.log(`robots drew ${drawn.length} bytes of ANSI output at ${secs()}`);
console.log("robots output (head):", JSON.stringify(drawn.slice(0, 400)));
console.log("PASS");
emulator.destroy();
process.exit(0);
