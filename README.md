# FinAdvisor

FinAdvisor helps Uzbek entrepreneurs build reliable restaurant financial plans.

## Repository layout

- `apps/web` - Next.js web application
- `apps/api` - FastAPI service
- `packages/finance-engine` - framework-independent Python calculation package
- `docs` - product and architecture documentation

## Quick start

1. Copy `.env.example` to `.env`.
2. Start the full stack: `docker compose up -d postgres redis api web`.
3. Or run services locally:

   ```powershell
   cd apps\api
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -e ..\..\packages\finance-engine
   pip install -e ".[dev]"
   uvicorn finadvisor_api.main:app --reload
   ```

   ```powershell
   cd apps\web
   npm install
   npm run dev
   ```

The API health check is available at `http://localhost:8000/health` and the web app at `http://localhost:3000`.

The API uses PostgreSQL and Redis configuration from `DATABASE_URL` and
`REDIS_URL`. Local development defaults to SQLite when `DATABASE_URL` is not
set; Docker Compose supplies PostgreSQL and Redis. Database migrations are kept under `apps/api/migrations`.

Publishing metadata is generated for all locale-prefixed pages, with `sitemap.xml`, `robots.txt`, `Open Graph` metadata, and locale-specific `hreflang` alternates. The desktop agent and web app are prepared to emit release assets in the GitHub Actions workflow.

Protected accounting and agent routes require a valid auth Bearer session token. The
desktop agent only queues synchronization commands; financial calculations
remain in `packages/finance-engine`.
