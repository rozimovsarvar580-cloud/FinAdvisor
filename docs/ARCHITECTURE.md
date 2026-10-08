---
noteId: "8c2c1120c30f11f1b92d93b180ce68c9"
tags: []

---

# FinAdvisor architecture

FinAdvisor is organized as a Next.js web application, a FastAPI service, a Python finance
engine package, and a Tauri desktop agent. The API is the connection point between the web
and desktop clients and the backend calculations and persistence.

## Components

- **Web — `apps/web`:** Next.js 14 App Router application with locale routes under
  `src/app/[locale]`. Browser-facing route handlers expose selected endpoints and forward
  requests such as plan generation and calculations to the configured FastAPI URL. The
  server-side authentication integration also exchanges login and OAuth credentials with
  the API.
- **API — `apps/api`:** FastAPI application assembled in `finadvisor_api.main`. It registers
  authentication, plans, calculations, chat, documents, marketplace, pricing and agent
  routers, along with legacy routers under `/api/v1`. It validates request payloads,
  orchestrates services, and uses SQLAlchemy sessions and models for database access; the
  database URL is configurable.
- **Finance engine — `packages/finance-engine`:** Python package imported by the API for
  financial calculations, including loan schedules, operating projections, tax comparisons
  and progressive commission. Its monetary calculations use `Decimal`. Tax rules are
  loaded from a packaged YAML file. The API returns prepared calculation results to clients;
  for generated plans, the API supplies those results as context for AI-generated prose.
- **Desktop — `apps/desktop`:** Tauri application with a JavaScript UI and Rust commands.
  The command layer authenticates against the API, retains the session token in its
  application state, then makes bearer-authenticated requests for device and command data,
  device registration, and statement-sync commands.

## Data flow

1. A web user interacts with the localized Next.js interface. For the observed plan
   generation and calculator paths, a Next.js route handler forwards the request body to
   the corresponding FastAPI endpoint and relays the response.
2. FastAPI validates inputs and calls the finance engine for calculations. For plan
   generation, the API prepares financial results first and passes those results with
   supplied business details to the AI client for prose; the response includes both the
   prose and the prepared calculations. Authenticated plan-saving paths persist generated
   plan data through SQLAlchemy.
3. The desktop UI invokes Tauri commands. Those commands call the configured API directly;
   login obtains a token, and later device and command requests send it as a bearer token.
   Device registration and statement-sync requests are handled by the API.
4. API database reads and writes use SQLAlchemy and the configured database. The desktop
   client does not directly call the finance engine or access the database.

This describes the repository’s current implementation paths, not an exhaustive promise
about every feature or deployment.
