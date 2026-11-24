// Restore out/state.bin.zst in node and check the launcher protocol over serial0 only:
//  1. ttyS0 is quiet after the restore;
//  2. "24 80 sh -c ..." runs at that size, without echoing the line, then prints END;
//  3. the launcher is READY again and runs "24 80 robots", which draws its board;
//  4. Ctrl-C ends robots with END, and the launcher is READY again.
// Exits non-zero on failure.
import path from "node:path";
import url from "node:url";
import { V86 } from "v86";

const out = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../out") + "/";
const { v86Options, snapshotUrl } = await import(path.join(out, "config.mjs"));

// Printed by image/playterminal-launcher.
const READY = "\x1b]777;playterminal;ready\x07";
const END = "\x1b]777;playterminal;exit\x07";
const TIMEOUT_MS = 30_000;
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(2) + " s";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const emulator = new V86({ ...v86Options(out), initial_state: { url: snapshotUrl(out) } });

let serial = "";
emulator.add_listener("serial0-output-byte", (b) => { serial += String.fromCharCode(b); });

function fail(msg) {
    console.error(`FAIL: ${msg}. ttyS0 so far:`, JSON.stringify(serial));
    process.exit(1);
}
async function until(cond, what) {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > TIMEOUT_MS) fail(`timed out waiting for ${what}`);
        await sleep(50);
    }
}
// Send a launch line; resolve with everything up to END once the launcher is READY again.
async function launch(line, during) {
    const mark = serial.length;
    emulator.serial0_send(line + "\n");
    if (during) await during(mark);
    await until(() => serial.slice(mark).includes(END + READY), `END and READY after ${JSON.stringify(line)}`);
    const s = serial.slice(mark);
    return s.slice(0, s.indexOf(END));
}

await new Promise((r) => emulator.add_listener("emulator-ready", r));
console.log(`Snapshot restored, emulator ready at ${secs()}`);
await sleep(500);
if (serial !== "") fail("ttyS0 not quiet after restore");
console.log("ttyS0 quiet after restore: ok");

const probe = await launch("24 80 stty size; echo TERM=$TERM");
console.log(`probe -> ${JSON.stringify(probe)} at ${secs()}`);
if (probe.includes("stty size")) fail("the launch line was echoed");
if (!probe.endsWith("24 80\r\nTERM=vt100\r\n")) fail("unexpected size or TERM");

const drawn = await launch("24 80 robots", async (mark) => {
    await until(() => {
        const s = serial.slice(mark);
        return s.includes("\x1b[") && s.includes("@") && s.includes("+") && s.length > 500;
    }, "robots to draw");
    await sleep(500);
    console.log(`robots drew ${serial.length - mark} bytes at ${secs()}`);
    console.log("robots output (head):", JSON.stringify(serial.slice(mark, mark + 300)));
    emulator.serial0_send("\x03");
});
console.log(`Ctrl-C ended robots with END, launcher READY again at ${secs()}`);
if (drawn.includes("localhost")) fail("a login prompt or motd reached ttyS0");

console.log("PASS");
emulator.destroy();
process.exit(0);
