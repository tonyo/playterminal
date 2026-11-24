# playterminal

PlayTerminal is an attempt to bring old-school console gaming back to life. The idea is to create a library of games you can play in a terminal and give an opportunity to run them, ehmm, without a terminal, i.e. right in your browser.

Deployed instance: https://playtermin.al

Games run in the visitor's browser, in the [v86](https://github.com/copy/v86) emulator
on an Alpine Linux VM Image built in [`vm/`](vm/README.md).


### Getting started

Dependencies: Docker and [mise](https://mise.jdx.dev). The app runs on
Python 3.14 and Django 5.2 LTS.

mise installs Python and [uv](https://docs.astral.sh/uv/) (`mise.toml`,
locked in `mise.lock`), and uv installs the Python dependencies into `.venv`
(`pyproject.toml`, locked in `uv.lock`). `mise tasks` lists the tasks.

1. Run `mise install && mise run setup`: it installs the tools, the
   dependencies and the git pre-commit hooks (ruff and file checks).

2. Create `.env.local` (gitignored):

   ```
   SECRET_KEY=<a long random string>
   CSRF_TRUSTED_ORIGINS=http://localhost:8090
   ```

   `CSRF_TRUSTED_ORIGINS` is only needed when the site is served on a
   non-default port, as in the local run below.

3. Build the VM Image and Snapshot: `cd vm && mise run build` (needs Node
   and Docker; see [vm/README.md](vm/README.md)). `compose.local.yaml`
   mounts `vm/out/` into nginx at `/v86/`; set `V86_OUT` to serve another
   output directory.

4. Build and start it on http://localhost:8090. `mise run up` builds the
   images, starts the stack, migrates and collects static files. Run it again
   after any change.

   ```
   mise run up
   mise run seed
   docker compose exec playterminal-server python manage.py createsuperuser
   ```

   mise sets `COMPOSE_FILE` to include `compose.local.yaml`, so plain
   `docker compose` commands run against the local stack. `mise run down`
   stops it.

   Play runs the Game's Command in v86 inside the browser: nothing runs on
   the server.

5. Run the tests: `mise run test`. Run every pre-commit hook on all files:
   `mise run lint`; format the Python code: `mise run format`.

Dependency updates: change `pyproject.toml` if needed, then run `uv lock`
(or `uv lock --upgrade`). Both uv (`exclude-newer`) and mise
(`minimum_release_age`) only pick releases at least 7 days old.
