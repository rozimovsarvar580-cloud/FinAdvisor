# FinAdvisor

FinAdvisor helps Uzbek entrepreneurs build reliable restaurant financial plans.

## Repository layout

- `apps/web` - Next.js web application
- `apps/api` - FastAPI service
- `packages/finance-engine` - framework-independent Python calculation package
- `docs` - product and architecture documentation

## Quick start

1. Copy `.env.example` to `.env`.
2. Start infrastructure: `docker compose up -d postgres redis`.
3. Start the API:

   ```powershell
   cd apps\api
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -e ..\..\packages\finance-engine
   pip install -e ".[dev]"
   uvicorn finadvisor_api.main:app --reload
   ```

4. Start the web app in another terminal:

   ```powershell
   cd apps\web
   npm install
   npm run dev
   ```

The API health check is available at `http://localhost:8000/health`.

The API uses PostgreSQL and Redis configuration from `DATABASE_URL` and
`REDIS_URL`. Local development defaults to SQLite when `DATABASE_URL` is not
set; Docker Compose supplies PostgreSQL. SQLAlchemy's initial `Plan` model is in `apps/api/app/models.py`;
database migrations are kept under `apps/api/migrations`.

Protected accounting and agent routes require a Bearer session token. The
desktop agent only queues synchronization commands; financial calculations
remain in `packages/finance-engine`.
