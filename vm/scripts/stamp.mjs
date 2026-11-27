// Rename the files out/config.mjs names after their content hash and point config.mjs
// at the new names: libv86.js -> libv86-<hash>.js, fs.json -> fs-<hash>.json, and so on.
// A rebuild then changes those URLs, so no browser or CDN can reuse a cached copy of an
// old one; only config.mjs keeps its name.
// Safe to run again: it reads the current names from out/config.mjs, and deletes
// stamped files that config.mjs no longer names.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const out = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../out");
const configPath = path.join(out, "config.mjs");
let config = readFileSync(configPath, "utf8");

const FILES = [
  { constant: "LIBV86", prefix: "libv86-", suffix: ".js" },
  { constant: "WASM", prefix: "v86-", suffix: ".wasm" },
  { constant: "SEABIOS", prefix: "seabios-", suffix: ".bin" },
  { constant: "VGABIOS", prefix: "vgabios-", suffix: ".bin" },
  { constant: "FS_JSON", prefix: "fs-", suffix: ".json" },
  { constant: "SNAPSHOT", prefix: "state-", suffix: ".bin.zst" },
];

for (const { constant, prefix, suffix } of FILES) {
  const line = new RegExp(`^const ${constant} = "([^"]+)";$`, "m");
  const match = config.match(line);
  if (!match) throw new Error(`no "const ${constant} = ..." line in ${configPath}`);
  const current = match[1];
  const hash = createHash("sha256")
    .update(readFileSync(path.join(out, current)))
    .digest("hex")
    .slice(0, 16);
  const stamped = `${prefix}${hash}${suffix}`;
  if (current !== stamped) renameSync(path.join(out, current), path.join(out, stamped));
  config = config.replace(line, `const ${constant} = "${stamped}";`);
  for (const name of readdirSync(out)) {
    if (name !== stamped && name.startsWith(prefix) && name.endsWith(suffix)) {
      rmSync(path.join(out, name));
    }
  }
  console.log(`${current} -> ${stamped}`);
}
writeFileSync(configPath, config);
