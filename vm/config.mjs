// Shared V86 options for the page and scripts/build-state.mjs. A saved state only
// restores correctly with the same options, so both must use this one function.
// `base` is the URL prefix (browser) or filesystem path (node) of the output dir,
// ending in "/". The build copies this file into that dir next to the files it names.

// The files this config names. After the Snapshot is saved, scripts/stamp.mjs renames
// each after its content hash (e.g. state-<hash>.bin.zst) and rewrites these lines in
// out/config.mjs, so a browser can cache them for good and a new build never reuses an
// old one. Only config.mjs keeps its name.
const LIBV86 = "libv86.js";
const WASM = "v86.wasm";
const SEABIOS = "seabios.bin";
const VGABIOS = "vgabios.bin";
const FS_JSON = "fs.json";
const SNAPSHOT = "state.bin.zst";

export function v86Options(base) {
  return {
    wasm_path: `${base}${WASM}`,
    bios: { url: `${base}${SEABIOS}` },
    vga_bios: { url: `${base}${VGABIOS}` },
    memory_size: 128 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    filesystem: {
      baseurl: `${base}rootfs-flat`,
      basefs: `${base}${FS_JSON}`,
    },
    bzimage_initrd_from_filesystem: true,
    cmdline:
      "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable",
    // ttyS1: the page sends the terminal size there (image/playterminal-resize).
    uart1: true,
    autostart: true,
  };
}

// URL/path of the Snapshot, relative to the same `base`.
export function snapshotUrl(base) {
  return `${base}${SNAPSHOT}`;
}

// URL/path of the emulator script that defines V86, relative to the same `base`.
export function libv86Url(base) {
  return `${base}${LIBV86}`;
}
