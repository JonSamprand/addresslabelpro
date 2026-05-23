# syntax=docker/dockerfile:1
#
# AddressLabelPro backend — FastAPI / Uvicorn
# Built for Cloud Run, which sets PORT and expects the container to bind
# on $PORT (default 8080) on 0.0.0.0.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Build deps for any wheels that need compiling (rare with the current
# requirements, but cheap insurance).
RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY migrations ./migrations

# Cloud Run injects PORT; default to 8080 for local docker run.
ENV PORT=8080
EXPOSE 8080

# Single worker is the right default for Cloud Run — the platform handles
# horizontal scaling. --proxy-headers makes slowapi see the real client IP
# through Google's load balancer.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers --forwarded-allow-ips='*'
