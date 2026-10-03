# FinAdvisor Copilot Instructions

## Product scope

FinAdvisor helps small-business owners in Uzbekistan, starting with restaurants,
prepare financially grounded business plans. Build only the currently requested
MVP scope; do not start the future investor marketplace or desktop agent without
explicit approval.

## Non-negotiable engineering rules

- All money and percentage calculations belong in `packages/finance-engine`.
  LLMs may explain supplied values or write prose, but must never calculate or
  invent figures.
- Never use floating point for money; use `Decimal` or integer tiyin.
- Keep tax and bank rates out of code. Store them in versioned configuration
  with source and effective date.
- Never put API keys in frontend code or commit secrets. Use environment
  variables and keep `.env` untracked.
- Add a pytest or Vitest test for every new function.
- Put user-facing text behind Uzbek, Russian, and English i18n message keys.
- Support both dark and light themes for every UI component.
- Keep changes focused: one component, endpoint, or module at a time.
- Preserve type safety, follow existing conventions, and run targeted checks.

## Stack

- `apps/web`: Next.js 14 App Router, TypeScript, Tailwind CSS, locale-prefixed
  routes, next-intl, next-themes, shadcn/ui, Vitest, and Playwright.
- `apps/api`: Python FastAPI, SQLAlchemy, Alembic, Pydantic, and pytest.
- `packages/finance-engine`: Python package using `Decimal` for financial
  calculations, with pytest.
- Infrastructure: PostgreSQL and Redis through Docker Compose; GitHub Actions
  for lint, test, and build.

## Repository layout

```text
apps/
  api/                 FastAPI application, migrations, and API tests
  web/                 Next.js application and frontend tests
packages/
  finance-engine/      Reusable Decimal-based financial calculations
.github/
  copilot-instructions.md
  workflows/           CI workflows
packages/finance-engine/src/finance_engine/
  tax_rules_2026.yaml  Versioned tax rules with sources and effective dates
docker-compose.yml
.env.example
```

Follow the requested stage boundaries. Do not implement later-stage product
features early, and update the relevant README when setup or commands change.
