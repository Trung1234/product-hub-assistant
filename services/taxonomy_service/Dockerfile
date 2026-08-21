FROM python:3.10-slim

WORKDIR /app

COPY main.py .
COPY data/printway_catalog.json ./data/

RUN pip install --no-cache-dir fastapi uvicorn pydantic scikit-learn

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
