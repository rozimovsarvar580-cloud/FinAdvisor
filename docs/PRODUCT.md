# FinAdvisor product

FinAdvisor is a multilingual financial planning assistant for Uzbek entrepreneurs,
starting with restaurants.

## Initial roles

- Entrepreneur: creates plans, runs calculators, exports reports.
- Investor: discovers published plans and communicates with owners.
- Administrator: moderates plans, manages knowledge and audit logs.

## Phase 0 acceptance criteria

- Web, API, and finance-engine packages have runnable minimal entry points.
- PostgreSQL and Redis start with one `docker compose` command.
- CI runs linting, tests, and a web build.
- Product hypotheses can be validated independently from the codebase.

## Core principles

Calculations are deterministic and auditable. Each result should eventually include
the formula and input values used. Tax rules are versioned and carry a source,
effective date, and reviewer.
