FROM python:3.14.10-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.9 /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# The locked runtime dependencies only (no dev group), into /app/.venv.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-cache

COPY . .
RUN mkdir -p playterminal/collected_static/

ENTRYPOINT ["gunicorn", \
    "-t", "300", \
    "--log-level", "debug", \
    "--workers", "4", \
    "--bind", "0.0.0.0:8010", \
    "--max-requests", "999", \
    "playterminal.wsgi:application"]
