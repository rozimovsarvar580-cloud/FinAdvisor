FROM python:3.12-slim

WORKDIR /app
COPY packages/finance-engine /tmp/finance-engine
COPY apps/api /app

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -e /tmp/finance-engine && \
    pip install --no-cache-dir -e /app[dev]

EXPOSE 8000

CMD ["uvicorn", "finadvisor_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
