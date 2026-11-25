// Restore the Snapshot out/config.mjs names in node and check the launcher protocol over serial0 only:
//  1. ttyS0 is quiet after the restore;
//  2. "24 80 sh -c ..." runs at that size, without echoing the line, then prints END;
//  3. the launcher is READY again and runs "24 80 robots", which draws its board;
//  4. Ctrl-C ends robots with END, the launcher is READY again (once), and runs the
//     next line;
//  5. "<rows> <cols>" on serial1 (ttyS1) resizes ttyS0 while a Command runs, and the
//     Command gets SIGWINCH;
//  6. every Game's Command in ../games/library/*.toml is installed;
//  7. tetris keeps drawing with no input: its drop timer fires, so the pieces fall.
// Exits non-zero on failure.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { V86 } from "v86";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const out = `${path.join(here, "../out")}/`;
const { v86Options, snapshotUrl } = await import(path.join(out, "config.mjs"));

// Printed by image/playterminal-launcher.
const READY = "\x1b]777;playterminal;ready\x07";
const END = "\x1b]777;playterminal;exit\x07";
const TIMEOUT_MS = 30_000;
const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(2)} s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const emulator = new V86({ ...v86Options(out), initial_state: { url: snapshotUrl(out) } });

let serial = "";
emulator.add_listener("serial0-output-byte", (b) => {
  serial += String.fromCharCode(b);
});

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
  emulator.serial0_send(`${line}\n`);
  if (during) await during(mark);
  await until(
    () => serial.slice(mark).includes(END + READY),
    `END and READY after ${JSON.stringify(line)}`,
  );
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

// The page starts the next Game on READY, so Ctrl-C must leave exactly one, and the
// launcher must still read the next line.
await sleep(500);
const afterEnd = serial.slice(serial.lastIndexOf(END));
if (afterEnd !== END + READY)
  fail(`expected one READY after Ctrl-C, got ${JSON.stringify(afterEnd)}`);
const again = await launch("24 80 echo again");
if (!again.endsWith("again\r\n")) fail("the launcher did not run the next line after Ctrl-C");
console.log(`one READY after Ctrl-C, next line runs: ok at ${secs()}`);

// The Command prints its size on SIGWINCH; Ctrl-C ends it.
const resized = await launch(
  "24 80 trap 'stty size' WINCH; echo waiting; while :; do sleep 0.2; done",
  async (mark) => {
    await until(() => serial.slice(mark).includes("waiting"), "the WINCH probe to start");
    emulator.serial_send_bytes(1, new TextEncoder().encode("30 100\n"));
    await until(() => serial.slice(mark).includes("30 100"), "SIGWINCH with the new size");
    emulator.serial0_send("\x03");
  },
);
console.log(`resize over ttyS1 -> ${JSON.stringify(resized)}: ok at ${secs()}`);

// The program each Command runs: its first word. The Game files are plain enough that the
// command line can be read without a TOML parser.
const library = path.join(here, "../../games/library");
const programs = readdirSync(library)
  .filter((name) => name.endsWith(".toml"))
  .map((name) => {
    const m = readFileSync(path.join(library, name), "utf8").match(/^command = "(\S+).*"$/m);
    if (!m) fail(`no command line in games/library/${name}`);
    return m[1];
  });
if (programs.length === 0) fail("no Games found in games/library");
const found = await launch(
  `24 80 for p in ${programs.join(" ")}; do command -v $p >/dev/null || echo MISSING $p; done`,
);
if (found.includes("MISSING")) fail(`Commands not in the VM Image: ${JSON.stringify(found)}`);
console.log(`every Game's Command is installed (${programs.join(", ")}): ok at ${secs()}`);

// Micro Tetris drops pieces from a SIGALRM timer (see image/micro-tetris-timer.patch).
await launch("24 80 tetris", async (mark) => {
  await until(() => serial.slice(mark).includes("quit"), "tetris to draw");
  await sleep(500);
  const drawn = serial.length;
  await until(() => serial.length > drawn + 50, "a tetris piece to fall with no input");
  emulator.serial0_send("\x03");
});
console.log(`tetris pieces fall on their own: ok at ${secs()}`);

console.log("PASS");
emulator.destroy();
process.exit(0);
