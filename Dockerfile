FROM python:3.6-slim

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
