# ChessMaster backend — FastAPI on Postgres.
# The Stockfish engine no longer runs server-side (analysis is client-side WASM),
# so no engine binary is needed in this image.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first (better layer caching). psycopg[binary],
# fastapi-users, etc. all ship wheels, so no build toolchain needed.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install .

# Alembic config + migrations (run via the release/pre-deploy hook).
COPY alembic.ini ./
COPY alembic ./alembic

# Render injects $PORT; default to 8000 for local `docker run`.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
