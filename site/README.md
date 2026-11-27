# Static site

PlayTerminal's pages, built by [Astro](https://astro.build) into plain HTML and hashed
assets in `dist/`. The pages need no server code; nginx serves `dist/` next to the VM files
(`/v86/`, built by [`../vm`](../vm/README.md)).

```sh
mise run site:dev     # http://localhost:4321, live reload; /v86/ comes from ../vm/out
mise run site:build   # dist/
mise run site:test    # build, then node:test (test/)
```

- **Games:** one TOML file per Game in `../games/`. `src/content.config.js` checks each
  file against a schema, and a bad file fails the build. Descriptions are Markdown, rendered by
  markdown-it with raw HTML off (`src/lib/markdown.js`).
- **Pages:** `src/pages/`, with the layout in `src/layouts/Base.astro`. The game page's scripts
  (`src/scripts/`) run xterm.js and the v86 emulator in the browser.
- **VM file location:** `PUBLIC_V86_BASE` at build time, default `/v86/`.

## Dependencies

Pinned exactly in `package.json`, locked in `package-lock.json`. `.npmrc` sets
`min-release-age=7`, so npm only installs releases at least 7 days old (as mise does).

- **Compiler pin:** `overrides` keeps `@astrojs/compiler-binding` at 0.5.2. Version 0.5.3 crashes
  with SIGILL on CPUs without AVX2
  ([withastro/compiler-rs#220](https://github.com/withastro/compiler-rs/issues/220)). Remove the
  override once a fixed release is out and at least 7 days old.
- **Telemetry:** mise sets `ASTRO_TELEMETRY_DISABLED=1`.
