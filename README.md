# playterminal

PlayTerminal is an attempt to bring old-school console gaming back to life. The idea is to create a library of games you can play in a terminal and give an opportunity to run them, ehmm, without a terminal, i.e. right in your browser.

Deployed instance: https://playtermin.al

Repository with games (Docker images): https://github.com/rev112/playterminal-images


### Getting started

Dependencies: Docker (the app runs on Python 3.14 and Django 5.2 LTS).

1. Create `.env.local` (gitignored):

   ```
   SECRET_KEY=<a long random string>
   CSRF_TRUSTED_ORIGINS=http://localhost:8090
   ```

   `CSRF_TRUSTED_ORIGINS` is only needed when the site is served on a
   non-default port, as in the local run below.

2. Build and start it. Without a local compose override that publishes the
   nginx port, add one (for example `ports: ["8090:80"]` on
   `playterminal-nginx`, and `pull_policy: build` on both services).

   ```
   docker compose up -d --build
   docker compose exec playterminal-server sh -c \
     "python manage.py migrate && python manage.py loaddata seed && python manage.py collectstatic --noinput"
   docker compose exec playterminal-server python manage.py createsuperuser
   ```

3. Run the tests inside the image (nothing is bind-mounted, so no root-owned
   files end up in the working tree):

   ```
   docker run --rm -e SECRET_KEY=test --entrypoint sh <server image> \
     -c "pip install -q -r requirements-dev.txt && pytest tests/ -p no:cacheprovider"
   ```

Requirements are exact pins maintained by hand in `requirements.txt` and
`requirements-dev.txt` (no pip-compile).
