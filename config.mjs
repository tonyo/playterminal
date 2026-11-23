// Shared V86 options for the page and scripts/build-state.mjs. A saved state only
// restores correctly with the same options, so both must use this one function.
// `base` is the URL prefix (browser) or filesystem path (node) of the output dir,
// ending in "/". The build copies this file into that dir next to the files it names.
export function v86Options(base) {
    return {
        wasm_path: base + "v86.wasm",
        bios: { url: base + "seabios.bin" },
        vga_bios: { url: base + "vgabios.bin" },
        memory_size: 128 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        filesystem: {
            baseurl: base + "rootfs-flat",
            basefs: base + "fs.json",
        },
        bzimage_initrd_from_filesystem: true,
        cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable",
        autostart: true,
    };
}

// URL/path of the Snapshot, relative to the same `base`.
export function snapshotUrl(base) {
    return base + "state.bin.zst";
}
