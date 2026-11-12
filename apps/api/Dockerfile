FROM python:3.12-slim AS build

WORKDIR /build
COPY packages/finance-engine /build/finance-engine
COPY apps/api /build/api
RUN pip install --no-cache-dir --prefix=/install /build/finance-engine /build/api

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app
COPY --from=build /install /usr/local
COPY apps/api /app
COPY docs/INVESTOR.md /app/docs/INVESTOR.md

RUN groupadd --system api && \
    useradd --system --gid api --home-dir /app api && \
    chown -R api:api /app

USER api
EXPOSE 8000

CMD ["uvicorn", "finadvisor_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
