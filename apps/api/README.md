# FinAdvisor API

FastAPI service with SQLAlchemy and Alembic.

Create a virtual environment, install the finance engine with
`pip install -e ..\..\packages\finance-engine`, then install this project with
`pip install -e ".[dev]"`. Run `uvicorn finadvisor_api.main:app --reload` from
`apps/api`. API tests run with `pytest`.

Set `DATABASE_URL` and `JWT_SECRET` from the repository's `.env` file before
starting the service. Apply database migrations from the repository root with
`alembic -c apps/api/alembic.ini upgrade head`.

Authentication routes: `POST /auth/register`, `POST /auth/login`, and
`GET /auth/me` (Bearer JWT). Social identity sign-in uses NextAuth in the web
application; provision linked social users through a trusted identity exchange
before enabling those providers for persistent API-account access.

`POST /pricing/commission` accepts an annual revenue string and returns a
progressive commission breakdown calculated by `packages/finance-engine`.

Financial calculations are exposed at `POST /calc/{type}` for `annuity`,
`differential`, `capex`, `payroll`, `tax-comparison`, `break-even`, `payback`,
`dscr`, and `reverse-revenue`. Submit monetary and percentage values as decimal
strings; responses include the formula and input values used. The 2026 tax
rules are versioned with their source and effective date in the finance-engine
package.

Plan exports are available at `POST /documents/{plan_id}/pdf` and
`POST /documents/{plan_id}/excel`. Send `{ "locale": "uz|ru|en", "plan":
{...} }` using the plan response returned by `POST /plans/generate`; exports
are generated on demand and are not persisted by this API. The PDF uses
ReportLab, and the formula-linked multi-sheet workbook uses openpyxl.

The desktop agent API is available at `/agent`: authenticated operators
can register devices, list their own devices and command history, and queue
statement-sync commands. Device and command records are persisted; a sync
command is queued for processing and does not itself read local bank files or
perform financial calculations.
