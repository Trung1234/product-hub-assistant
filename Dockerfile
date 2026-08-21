# =========================================================================
# PRODUCTION DOCKERFILE FOR PRINTWAY NEXUS BACKEND
# =========================================================================

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=2024 \
    HOST=0.0.0.0

# Install essential compilation and database dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy application source code
COPY . /app/

# Expose server ports
EXPOSE 2024 10000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-2024}/ok || exit 0

# Start LangGraph server via server.py
CMD ["python", "server.py"]
