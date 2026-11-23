// Shared V86 options for the page and scripts/build-state.mjs. A saved state only
// restores correctly with the same options, so both must use this one function.
// `base` is a URL prefix (browser) or a filesystem path (node), ending in "/".
export function v86Options(base) {
    return {
        wasm_path: base + "v86/v86.wasm",
        bios: { url: base + "v86/seabios.bin" },
        vga_bios: { url: base + "v86/vgabios.bin" },
        memory_size: 128 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        filesystem: {
            baseurl: base + "images/rootfs-flat",
            basefs: base + "images/fs.json",
        },
        bzimage_initrd_from_filesystem: true,
        cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable",
        autostart: true,
    };
}
