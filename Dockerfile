FROM python:3.6-slim

# install git, remove apt cache
RUN apt-get update \
    && apt-get install -y git --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN mkdir -p playterminal/collected_static/

ENTRYPOINT ["gunicorn", \
    "-t", "300", \
    "--log-level", "debug", \
    "--workers", "4", \
    "--bind", "0.0.0.0:8010", \
    "--max-requests", "999", \
    "playterminal.wsgi:application"]
