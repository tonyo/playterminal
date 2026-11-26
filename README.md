# playterminal

PlayTerminal is an attempt to bring old-school console gaming back to life. The idea is to create a library of games you can play in a terminal and give an opportunity to run them, ehmm, without a terminal, i.e. right in your browser.

Deployed instance: https://playtermin.al

Games run in the visitor's browser, in the [v86](https://github.com/copy/v86) emulator
on an Alpine Linux VM Image built in [`vm/`](vm/README.md).


### Getting started

Dependencies: Docker (with buildx) and [mise](https://mise.jdx.dev).
`mise tasks` lists the tasks.

The site is static: [`site/`](site/README.md) is an Astro project that
renders every page at build time from the Games, one TOML file per Game in
`games/library/` (see its README). Play runs the Game's Command in v86 inside
the browser: nothing runs on the server. The whole site ships as one nginx
image, `tonyo/playterminal`, built by `Dockerfile` and `docker-bake.hcl`:
the VM Image and Snapshot (built from `vm/` and verified in the build), the
site (built and tested in the build), and the nginx config in
`nginx/site.conf`.

1. Run `mise install && mise run setup`: it installs the tools, the
   dependencies and the git pre-commit hooks (Biome for the JS and CSS in
   `biome.jsonc`, ruff, djLint, file checks).

2. Build the image and serve it on http://localhost:8090: `mise run up`
   (the first build takes a few minutes; later ones reuse the Docker cache).
   `mise run smoke` checks it over HTTP, `mise run down` stops it.

3. Work on the pages with live reload: `mise run site:dev`. It serves the
   VM files from `vm/out/`; build them once with `cd vm && mise run build`.

4. Run the tests: `mise run site:test` (the site) and `mise run test`. Run
   every pre-commit hook on all files: `mise run lint`.

Deploy: `docker buildx bake` builds `tonyo/playterminal`; push it, and the
server runs it with `docker-compose.yaml`.

The Django app (`games/`, `playterminal/`, `manage.py`) is no longer built
or deployed, and will be removed.

Dependency updates: change `pyproject.toml` if needed, then run `uv lock`
(or `uv lock --upgrade`). Both uv (`exclude-newer`) and mise
(`minimum_release_age`) only pick releases at least 7 days old.
