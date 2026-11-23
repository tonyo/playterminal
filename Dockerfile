FROM python:3.14.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p playterminal/collected_static/

ENTRYPOINT ["gunicorn", \
    "-t", "300", \
    "--log-level", "debug", \
    "--workers", "4", \
    "--bind", "0.0.0.0:8010", \
    "--max-requests", "999", \
    "playterminal.wsgi:application"]
