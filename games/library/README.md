# The Games

One file per Game: `<slug>.toml`, where the slug is the page URL (`/game/<slug>/`).

```toml
name = "Robots"                # the title on the games page and the Game's page
command = "robots"             # the shell command that starts the Game in the VM Image
displayed = true               # listed on the games page (optional, default false)
refresh_code = 12              # a key code sent after each launch to redraw (optional)
description = """
Markdown, shown on the Game's page. Raw HTML is escaped.
"""
```

The games page lists the displayed Games by name. `vm/image/Dockerfile` installs the
programs, and `vm/scripts/verify.mjs` checks that every Command is in the VM Image.
