# AnalyzeIt parser/agent service — production container.
# Builds the FastAPI + DuckDB + Polars + openpyxl compute service.
# Hosts (Railway/Render/Fly) inject $PORT; we bind to it, defaulting to 8100.
FROM python:3.13-slim

# System deps: build-essential covers any wheels that need compiling; curl is
# used by the container HEALTHCHECK below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY app ./app

ENV PYTHONUNBUFFERED=1 \
    PORT=8100

EXPOSE 8100

# Shell form so $PORT expands at runtime (hosts set it, e.g. Render/Railway).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
