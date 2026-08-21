# =========================================================================
# PRODUCTION DOCKERFILE FOR PRINTWAY PRODUCT OPPORTUNITY HUB BACKEND
# Runs LangGraph Agent API Server + Fast Report Downloader
# =========================================================================

FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=2024 \
    HOST=0.0.0.0

# Install essential system packages and headless browser dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install "langgraph-cli[inmem]" uvicorn

# Install Playwright browser binaries (for local fallback if needed)
RUN playwright install chromium --with-deps || true

# Copy project files
COPY . /app/

# Expose LangGraph API port
EXPOSE 2024 8001

# Healthcheck to ensure container is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:2024/ok || exit 1

# Start LangGraph server
CMD ["langgraph", "dev", "--host", "0.0.0.0", "--port", "2024"]
