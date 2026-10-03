# FinAdvisor API

FastAPI service with SQLAlchemy and Alembic.

Create a virtual environment, install with `pip install -e ".[dev]"`, then run
`uvicorn finadvisor_api.main:app --reload` from `apps/api`. API tests run with
`pytest`.

Set `DATABASE_URL` and `JWT_SECRET` from the repository's `.env` file before
starting the service. Apply database migrations from the repository root with
`alembic -c apps/api/alembic.ini upgrade head`.

Authentication routes: `POST /auth/register`, `POST /auth/login`, and
`GET /auth/me` (Bearer JWT). Social identity sign-in uses NextAuth in the web
application; provision linked social users through a trusted identity exchange
before enabling those providers for persistent API-account access.
