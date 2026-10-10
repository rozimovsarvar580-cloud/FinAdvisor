---
noteId: "72f92000c30811f1b92d93b180ce68c9"
tags: []

---

# FinAdvisor: tasks from today's repo to a published, revenue-capable product

GOAL (definition of "launched"): a stranger can open the public site in uz/ru/en, sign up (email, Google or
Facebook), build and analyze a business plan with AI, hit the Free limit, pay for Pro or Business through a
real payment provider, receive Pro features, download PDF/Excel, install the desktop agent, and the owner can
see revenue in the admin panel. Tax/bank figures are sourced, legal pages are reviewed, and production is
monitored and backed up.

HOW THIS FILE WORKS (read once)
- The loop takes the FIRST open agent task whose `needs:` are all done. Order = priority.
- `H*` tasks are for the HUMAN (accounts, money, legal, decisions). The loop never does them. After you
  finish one, change its `[ ]` to `[x]`; tasks that need it unlock.
- Machine checks under a task: `exists:`, `absent:`, `contains: path :: text`, `not-contains: path :: text`,
  `cmd: ...` ({{PY}} = python). `node scripts/verify.mjs` always runs too and marks unchecked tasks
  complete when their explicit machine checks pass.
- Agents may APPEND new tasks at the end of a stage; they must not reorder or edit existing ones.
- If a feature already exists in the repo, the task means: complete it, test it, make it match the spec.

Conventions: web = `apps/web/src`, api = `apps/api/src/finadvisor_api`, api tests = `apps/api/tests`,
engine = `packages/finance-engine`.

## Stage 0 - Foundation and cleanup
- [x] 0.1 Make `node scripts/verify.mjs` pass on the current repo
  - done: lint, types, unit tests, locale test, ruff, pytest and secret scan all green; minimal fixes only, no feature work, no deleted tests
  - max_fails: 10
- [x] 0.2 Housekeeping: remove machine-specific task paths, CI uses verify, root verify script
  - done: `.vscode/tasks.json` stays but only has portable tasks (relative paths, no `C:\Users`); CI uses `npm ci` and runs `node scripts/verify.mjs`; root `package.json` has a `verify` script
  - not-contains: .vscode/tasks.json :: C:\Users
  - contains: package.json :: "verify"
  - contains: .github/workflows/ci.yml :: scripts/verify.mjs
- [x] 0.3 Audit the two web app trees
  - done: `specs/audit-web.md` has a table route / exists in `apps/web/app` / exists in `apps/web/src/app` / decision (keep, port, delete); no code changes
  - exists: specs/audit-web.md
- [x] 0.4 Merge web trees into `apps/web/src/app/[locale]`
  - done: every "port" route lives under `src/app/[locale]`; `apps/web/app` and the duplicate root middleware are deleted; tailwind content globs cover all sources; build passes
  - absent: apps/web/app
  - exists: apps/web/src/app/[locale]/page.tsx
- [x] 0.5 Audit the two API trees
  - done: `specs/audit-api.md` lists routers, models and tests that exist only in `apps/api/app`
  - exists: specs/audit-api.md
- [x] 0.6 Merge API trees into `finadvisor_api`
  - done: unique routers/models/tests ported, `apps/api/app` deleted, single entry point `finadvisor_api.main:app`
  - absent: apps/api/app
- [x] 0.7 One linear Alembic history with a migration test
  - done: exactly one Alembic head; `alembic upgrade head` works on a fresh SQLite database
  - exists: apps/api/tests/test_migrations.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_migrations.py -q
- [x] 0.8 Complete `.env.example` and config module
  - done: `.env.example` documents DATABASE_URL, REDIS_URL, JWT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, INTERNAL_API_KEY, GOOGLE_CLIENT_ID/SECRET, FACEBOOK_CLIENT_ID/SECRET, EMAIL_*, PAYMENT_*, SENTRY_DSN, API base URLs; API settings load and validate them in one place and fail fast in production if a required one is missing
  - contains: .env.example :: INTERNAL_API_KEY
  - contains: .env.example :: PAYMENT_PROVIDER
- [x] 0.9 Commit the loop kit conventions
  - done: `specs/DECISIONS.md` defaults are referenced from `.github/copilot-instructions.md`; `docs/ARCHITECTURE.md` (1 page) describes web / api / engine / desktop and the data flow
  - exists: docs/ARCHITECTURE.md

## Review findings
(The reviewer pass appends tasks here. They run before the stages below.)

## Stage 1 - Design system (Midnight Indigo + Amber)
- [x] 1.1 Component test setup
  - done: Vitest runs `*.test.tsx` with jsdom and Testing Library; one sample component test passes
  - cmd: cd apps/web && npx vitest run --reporter=dot
- [x] 1.2 Tokens and fonts
  - done: light and dark HSL tokens from `specs/DECISIONS.md` palette in `globals.css`; Plus Jakarta Sans + Inter via next/font (latin, latin-ext, cyrillic); Arial removed; smooth scroll and prefers-reduced-motion
  - contains: apps/web/src/app/globals.css :: --gradient-brand
  - not-contains: apps/web/src/app/globals.css :: Arial
- [x] 1.3 Button component
  - done: variants primary, gradient, accent, outline, ghost; sizes sm/md/lg; hover lift, shadow, active press, focus ring, disabled, loading; tested
  - exists: apps/web/src/components/ui/button.tsx, apps/web/src/components/ui/button.test.tsx
  - contains: apps/web/src/components/ui/button.tsx :: active:scale
- [x] 1.4 Hover and focus for all primitives
  - done: Card, Input, Select, Tabs, nav links (animated underline), LocaleSwitcher, ThemeToggle all have hover, focus-visible and disabled states in both themes
- [x] 1.5 Motion kit
  - done: Reveal, Stagger, CountUp, Marquee built on framer-motion, render static content under reduced motion, tested
  - exists: apps/web/src/components/motion/reveal.tsx, apps/web/src/components/motion/count-up.tsx, apps/web/src/components/motion/stagger.tsx
- [x] 1.6 Header, scroll progress and theme transition
  - done: sticky header turns translucent with backdrop blur on scroll; thin scroll progress bar; theme switch transitions smoothly; mobile menu works
- [x] 1.7 Token-only colors guard
  - done: `scripts/check-tokens.mjs` fails when a hex or rgb color literal appears in `apps/web/src/components` or `apps/web/src/app` (except lines marked `allow-hex`, used by brand logos); verify.mjs picks it up automatically; existing violations fixed
  - exists: scripts/check-tokens.mjs
  - cmd: node scripts/check-tokens.mjs

## Stage 2 - Public pages, pricing, i18n
- [x] 2.1 Landing: hero, stats, problem
  - done: hero with headline, two CTAs and an animated dashboard mockup (divs/SVG, no remote images); animated stats; problem cards (how much money, how many staff, which bank, taxes, credit)
- [x] 2.2 Landing: the rest
  - done: 4-step flow, 8 feature cards, investors block, desktop agent block, pricing teaser, FAQ accordion, final CTA, footer; all via i18n keys
- [x] 2.3 Pricing config single source of truth
  - done: `apps/web/src/config/pricing.ts` defines Free $0, Pro $10/week, Business $20/week with feature lists from DECISIONS; API exposes `GET /pricing/plans` with the same data; a test asserts they match; monthly/yearly derived per DECISIONS D1 and marked `TODO(DECISION D1)`
  - exists: apps/web/src/config/pricing.ts, apps/api/tests/test_pricing_plans.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_pricing_plans.py -q
- [x] 2.4 Pricing page UI
  - done: animated weekly/monthly/yearly toggle, three cards (Pro highlighted), hover lift, sticky comparison table, FAQ, refund note, CTA buttons route to signup or checkout
- [x] 2.5 Commission calculator
  - done: slider/input on pricing and Business pages calls the API; progressive result: 0-100M UZS 4%, 100M-1B 2%, above 1B 1% (150M gives 5,000,000); explains it is calculated on annual revenue recorded by the desktop agent
  - cmd: {{PY}} -m pytest packages/finance-engine/tests -q -k commission
- [x] 2.6 About page
  - done: mission, who we help (entrepreneurs, accountants, investors), how it works, values, CTA; animated; 3 languages
- [x] 2.7 Legal pages (drafts)
  - done: /terms, /privacy, /refund, /ai-disclaimer in 3 languages, linked from footer and signup; text is a clearly marked draft with `TODO(LEGAL)` where a lawyer must decide; AI disclaimer says output is an estimate, not financial, tax or legal advice
  - exists: apps/web/src/app/[locale]/terms/page.tsx, apps/web/src/app/[locale]/privacy/page.tsx
- [x] 2.8 Error, 404, loading and empty states
  - done: branded not-found, error boundary, route loading skeletons, empty states for lists
  - exists: apps/web/src/app/[locale]/not-found.tsx, apps/web/src/app/[locale]/error.tsx, apps/web/src/app/[locale]/route-boundaries.test.tsx
  - cmd: npm.cmd --workspace apps/web test -- src/components/ui/route-states.test.tsx
- [x] 2.9 Hard-coded string audit
  - done: no user-facing literal text left in `apps/web/src/**/*.tsx` (JSX text, placeholder, aria-label, title, alt, toast, zod messages); all moved to uz/ru/en keys
  - exists: apps/web/src/i18n/hard-coded-copy-audit.test.ts
  - cmd: npm.cmd --workspace apps/web test -- src/i18n/hard-coded-copy-audit.test.ts
- [x] 2.10 Locale quality test
  - done: Vitest/Node test fails if uz/ru/en key sets differ or if a ru/uz value equals its English value (whitelist for brand names and numbers)
  - exists: apps/web/scripts/test-locales.mjs
- [x] 2.11 Translation review pass
  - done: uz in Latin script with formal register, ru natural business style; machine-like wording fixed; a short report in `specs/i18n-review.md`
  - exists: specs/i18n-review.md
- [x] 2.12 SEO basics
  - done: per-locale metadata, hreflang, sitemap.xml, robots.txt, Open Graph image, JSON-LD for the product
  - exists: apps/web/src/app/sitemap.ts, apps/web/src/app/robots.ts

## Stage 3 - Authentication and accounts
- [x] 3.1 Auth data model
  - done: users (role, email_verified, avatar, locale), oauth_accounts, refresh_tokens, email_tokens (hashed, single-use, expiry) with migrations
  - exists: apps/api/tests/test_auth_data_model.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_data_model.py apps/api/tests/test_migration_chain.py -q
- [x] 3.2 Register, login, refresh, logout
  - done: argon2 passwords, short-lived access token, rotating hashed refresh token, logout revokes; brute-force protection per account and IP
  - exists: apps/api/tests/test_auth_core.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_core.py -q
- [x] 3.3 Email verification and password reset
  - done: endpoints for forgot-password, reset-password, verify-email, resend; tokens single-use, 1h/24h expiry; no user enumeration in responses
  - exists: apps/api/tests/test_auth_email_flows.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_email_flows.py -q
- [x] 3.4 OAuth backend endpoint
  - done: `POST /auth/oauth` finds or creates a user from {provider, provider_account_id, email, name, avatar}; requires header `X-Internal-Key` == INTERNAL_API_KEY; returns tokens, user and `is_new`; links accounts by verified email safely
  - exists: apps/api/tests/test_auth_oauth.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_oauth.py -q
- [x] 3.5 EmailSender
  - done: interface with console implementation (dev) and SMTP/Resend implementation selected by env; templates in uz/ru/en for verify, reset, welcome; tested with a fake
  - exists: apps/api/src/finadvisor_api/email_sender.py
- [x] 3.6 NextAuth integration
  - done: Google and Facebook sign-in call `/auth/oauth` with the internal key and put accessToken, role, needsRole into the session; refresh handled; locale-aware sign-in page (no hard-coded /uz/login); types in `next-auth.d.ts`; callbacks tested
  - exists: apps/web/src/lib/auth.test.ts
  - cmd: npm.cmd --workspace apps/web test -- src/lib/auth.test.ts
- [x] 3.7 Role onboarding
  - done: new OAuth users pick tadbirkor, buxgalter or investor at `/[locale]/onboarding/role` (`PATCH /me`); guarded so it cannot be skipped
  - exists: apps/api/tests/test_auth.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth.py -q
  - exists: apps/web/src/components/auth/role-onboarding-form.test.tsx
  - cmd: npm.cmd --workspace apps/web test -- src/components/auth/role-onboarding-form.test.tsx src/middleware.test.ts src/lib/auth.test.ts
- [x] 3.8 Login and signup UI
  - done: two-column layout with animated brand panel; react-hook-form + zod; show/hide password, strength meter, inline errors, loading state, remember me, translated server errors, terms checkbox linking to legal pages; tests
  - exists: apps/web/src/components/auth/auth-forms.test.tsx
  - cmd: npm.cmd --workspace apps/web test -- src/components/auth/auth-forms.test.tsx src/components/legal/legal-document.test.tsx
- [x] 3.9 Forgot, reset and verify pages
  - done: pages for forgot-password, reset-password, verify-email with success and error states in 3 languages
  - exists: apps/web/src/components/auth/auth-recovery.test.tsx
  - cmd: npm.cmd --workspace apps/web test -- src/components/auth/auth-recovery.test.tsx src/app/api/auth/auth-flow-routes.test.ts src/components/auth/auth-forms.test.tsx
- [ ] 3.10 Social buttons
  - done: Google and Facebook buttons with brand SVG logos (`allow-hex`), hover/active effects; disabled with tooltip when provider env vars are missing (server helper, secrets never exposed)
- [ ] 3.11 Route protection and profile
  - done: middleware protects `/app/*`; role-based redirects; profile/settings page (name, language, password change, connected accounts, delete account request)
- [ ] 3.12 Authorization test matrix
  - done: pytest matrix proving owner / accountant / investor / anonymous access for every router, including IDOR checks (user A cannot read user B's plan or ledger)
  - exists: apps/api/tests/test_authorization_matrix.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_authorization_matrix.py -q

## Stage 4 - AI (single key file, backend only)
- [ ] 4.1 Key file loader
  - done: `apps/api/ai.config.json` ({provider, api_key, model}) is read first, `OPENAI_API_KEY` env second; cached; clear `AIClientError` when missing; `ai.config.example.json` committed, real file git-ignored; key never logged
  - exists: apps/api/ai.config.example.json, apps/api/tests/test_ai_config.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_config.py -q
- [ ] 4.2 Provider interface
  - done: `AIProvider` protocol (generate, stream) with OpenAI implementation and a deterministic fake for tests; timeouts, retries with backoff, error mapping
- [ ] 4.3 Admin AI status
  - done: `GET /admin/ai-status` returns only {connected, provider, model}; shown on the admin page
- [ ] 4.4 Prompt-injection defenses
  - done: all uploaded or user text goes into delimited data blocks; system prompt states it is data, not instructions; tests with hostile documents ("ignore previous instructions", "reveal the key") prove outputs are unaffected and no secret is reachable
  - exists: apps/api/tests/test_ai_prompt_injection.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_prompt_injection.py -q
- [ ] 4.5 AI plan generation
  - done: input = structured restaurant data (city, area, seats, staff such as 10 cooks and 20 waiters, budget, goal such as 100M profit); numbers come only from finance-engine; LLM writes narrative sections; output JSON + markdown; streaming progress
- [ ] 4.6 Number-consistency eval
  - done: test extracts every number from generated text and fails if it is not in the engine's output for that plan; runs with the fake provider
  - exists: apps/api/tests/test_ai_number_consistency.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_number_consistency.py -q
- [ ] 4.7 Document text extraction
  - done: PDF, DOCX, XLSX, TXT extraction with size and page limits, content-type sniffing (not extension only), safe temp handling
- [ ] 4.8 Plan analysis and bank-readiness score
  - done: versioned `bank_checklist.yaml` (market analysis, financial projections, repayment ability, risks, collateral, team, legal); analysis returns score per criterion, missing items, concrete fixes and rewritten weak sections
  - exists: apps/api/src/finadvisor_api/data/bank_checklist.yaml
- [ ] 4.9 Bank-readiness evals
  - done: 6 sample plans (weak, medium, strong, two with missing sections, one hostile) with expected score ranges; test fails when ranking is wrong
  - exists: apps/api/tests/test_bank_readiness_eval.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_bank_readiness_eval.py -q
- [ ] 4.10 Advisory chat
  - done: `/chat/stream`, intents (tax, credit, staffing, marketing, bank choice), knowledge retrieval, answers cite supplied figures and state uncertainty; conversation history stored per user
- [ ] 4.11 Investor Q&A generator
  - done: given a plan, returns likely investor questions with draft answers grounded only in plan data
- [ ] 4.12 AI usage metering and limits
  - done: tokens/requests counted per user per day; Free/Pro/Business limits from DECISIONS enforced server-side; friendly 429 with upgrade hint; admin can see cost per user
  - exists: apps/api/tests/test_ai_limits.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_limits.py -q
- [ ] 4.13 AI UI
  - done: FinAdvisor page with chat, plan wizard entry, analyze-my-plan upload, streaming responses, copy/export buttons, loading and error states, disclaimer visible
- [ ] 4.14 Live AI smoke script
  - done: `scripts/ai-smoke.py` makes one real request through the configured key and prints OK or the error; never prints the key
  - needs: H4
  - exists: scripts/ai-smoke.py

## Stage 5 - Finance engine, plans and documents
- [ ] 5.1 Golden tests for existing engine
  - done: at least 25 golden tests (known inputs, expected outputs) across tax, loans, payroll, profitability, commission; including commission 150M = 5,000,000 and boundary cases at 100M and 1B
  - exists: packages/finance-engine/tests/test_golden.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_golden.py -q
- [ ] 5.2 Startup cost and equipment
  - done: restaurant startup cost model (rent deposit, renovation, kitchen equipment, furniture, licenses, initial stock, marketing, reserve) with editable price tables in versioned YAML marked `TODO(VERIFY)` prices
- [ ] 5.3 Staffing and payroll
  - done: payroll for any role mix (e.g. 10 cooks, 20 waiters, plus manager, cleaner, accountant, cashier, delivery), employer taxes/contributions from the tax YAML, monthly and yearly totals
- [ ] 5.4 Tax rules with provenance
  - done: `tax_rules_2026.yaml` where every rule has `source_url`, `effective_date`, `verified` (default false) and `verified_by`; test fails if a rule lacks these; UI shows an "estimate" badge while `verified: false`
  - exists: packages/finance-engine/tests/test_tax_rules_provenance.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_tax_rules_provenance.py -q
- [ ] 5.5 Loans
  - done: annuity and differentiated schedules, DSCR, affordability check, bank product table in versioned YAML with source fields like tax rules
- [ ] 5.6 Revenue, profit, break-even
  - done: daily/weekly/monthly/yearly projections, profit target solver ("what revenue do I need for 100M profit"), break-even, sensitivity table
- [ ] 5.7 Calculators API
  - done: one endpoint per calculator with Pydantic schemas, validation of ranges, tests
  - exists: apps/api/tests/test_calculators_api.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_calculators_api.py -q
- [ ] 5.8 Calculators UI
  - done: pages for startup cost, payroll, tax, loan, profit/break-even with live results, charts, save-to-plan; mobile friendly
- [ ] 5.9 Plan wizard end to end
  - done: wizard -> engine numbers -> AI narrative -> editable plan -> versions -> export; resumable drafts
- [ ] 5.10 Excel export
  - done: workbook with assumptions, startup costs, payroll, P&L by month, loan schedule, break-even; real formulas where practical; test opens it with openpyxl
  - exists: apps/api/tests/test_export_xlsx.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_export_xlsx.py -q
- [ ] 5.11 PDF business plan
  - done: investor/bank-ready PDF with cover, summary, market, operations, staffing, financials with charts, risks, appendix; uz/ru/en; fonts support Cyrillic and Uzbek characters; test checks page count and text presence
  - exists: apps/api/tests/test_export_pdf.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_export_pdf.py -q
- [ ] 5.12 Bank pack and Synergy PDF
  - done: separate "bank pack" PDF (loan request, repayment schedule, collateral section, bank-readiness score) and "Agent-Synergy" PDF (operating strategy)
- [ ] 5.13 Downloads in the web UI
  - done: download buttons with progress/error states on the plan page; files named sensibly; export limited by tier
- [ ] 5.14 Plan history and sharing
  - done: versions, restore, duplicate; share-link toggle (read-only, revocable)

## Stage 6 - Money: subscriptions, payments, commission
- [ ] 6.1 Billing data model
  - done: subscriptions, invoices, payments, payment_events (raw webhook log), commission_ledger, refunds with migrations; money stored as integer minor units with currency
- [ ] 6.2 Plan limits middleware
  - done: Free/Pro/Business limits (plans, AI requests, exports, desktop agent, marketplace listing) enforced server-side from one config; tests prove a Free user is blocked and a Pro user is allowed
  - exists: apps/api/tests/test_plan_limits.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_plan_limits.py -q
- [ ] 6.3 PaymentProvider interface and fake
  - done: `PaymentProvider` (create_checkout, verify_webhook, cancel, refund) with a fake used in dev and tests
- [ ] 6.4 Checkout flow
  - done: choose plan -> checkout -> success/cancel pages; amount always computed server-side; subscription activates only from a verified webhook
- [ ] 6.5 Webhooks done right
  - done: signature verification, idempotency (replayed event changes nothing), out-of-order tolerance, every event stored; tests for forged signature and replay
  - exists: apps/api/tests/test_webhooks.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_webhooks.py -q
- [ ] 6.6 Real payment provider
  - done: implementation for the provider chosen in H7 with sandbox keys from env; contract tests against recorded fixtures
  - needs: H7
- [ ] 6.7 Billing page
  - done: current plan, next charge date, invoices list, change plan, cancel (keeps access until period end), update payment method
- [ ] 6.8 Weekly renewals job
  - done: scheduler creates invoices for weekly subscriptions, retries failed payments (dunning schedule from DECISIONS), downgrades after the grace period, emails the user in their language; tested with a fake clock
  - exists: apps/api/tests/test_renewals.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_renewals.py -q
- [ ] 6.9 Refunds and cancellations
  - done: refund endpoint and admin action per the refund policy in DECISIONS; ledger stays consistent
- [ ] 6.10 Commission ledger
  - done: Business accounts' annual revenue recorded through the desktop agent feeds `calculate_progressive_commission`; monthly commission statements generated with the calculation shown; owner can view and dispute; admin can export
  - exists: apps/api/tests/test_commission_ledger.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_commission_ledger.py -q
- [ ] 6.11 Admin revenue dashboard
  - done: MRR/weekly revenue, active subscribers per plan, churn, failed payments, commission accrued, AI cost vs revenue per user; CSV export
- [ ] 6.12 Funnel analytics
  - done: privacy-friendly first-party events (visit, signup, plan_created, export, checkout_started, paid) stored server-side with consent; admin funnel view

## Stage 7 - Investor marketplace
- [ ] 7.1 Listings
  - done: owner publishes a plan as a listing with visibility controls (what financial detail is public, what needs a request); draft/published/archived
- [ ] 7.2 Discovery
  - done: search and filters (city, sector, funding amount, stage), pagination, saved listings, saved searches
- [ ] 7.3 Contact and messaging
  - done: investor sends a contact request, owner accepts/declines, then threaded messages with email notifications; rate limits
  - exists: apps/api/tests/test_marketplace_messages.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_marketplace_messages.py -q
- [ ] 7.4 Investor verification
  - done: investor profile and KYC status flow (submitted, approved, rejected) with admin review; only approved investors see detailed financials
- [ ] 7.5 Moderation
  - done: report listing/message, admin review queue, hide/ban actions, audit log entries
- [ ] 7.6 Marketplace UI
  - done: investor dashboard, listing page, inbox, owner view of interest; new design system; 3 languages

## Stage 8 - Desktop agent (Windows and macOS)
- [ ] 8.1 Accounting API for the agent
  - done: endpoints for inventory, stock movements, sales, expenses, employees with RBAC (accountant writes, owner reads and issues commands, investor denied); idempotent sync endpoints with client ids
  - exists: apps/api/tests/test_accounting_rbac.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_accounting_rbac.py -q
- [ ] 8.2 Reports API
  - done: `GET /reports/{day|week|month|year}`: revenue, expenses, profit, taxes, stock in/sold/remaining; Excel and PDF export
- [ ] 8.3 Agent commands
  - done: owner issues commands (generate growth plan, generate report, explain this month); stored, executed by backend/AI, results delivered to owner and agent
- [ ] 8.4 App shell and login
  - done: Tauri app shell with login against the API, language and theme, same design tokens; session token stored in the OS keychain, never in plain files
- [ ] 8.5 Dashboard
  - done: day/week/month/year revenue, profit, taxes, stock overview with charts, offline-friendly
- [ ] 8.6 Accountant screens
  - done: inventory in/out, sales entry, expense entry, product catalog; validation and keyboard-friendly forms
- [ ] 8.7 Offline and sync
  - done: local SQLite, offline queue, sync with idempotent ids, conflict rule documented (server timestamp wins), sync status indicator; tests for the sync logic
- [ ] 8.8 Agent chat and commands UI
  - done: owner chat and command box; AI requests only via the API (the desktop app contains no AI key; test greps the bundle sources)
- [x] 8.9 Bundling and CSP
  - done: bundle targets msi, nsis, dmg enabled; CSP allows only the API origin; app identifier and version set
  - not-contains: apps/desktop/src-tauri/tauri.conf.json :: "active": false
- [x] 8.10 Release workflow
  - done: GitHub Actions matrix (windows-latest, macos-latest) with tauri-action builds installers and attaches them to a GitHub Release on version tags
  - exists: .github/workflows/desktop-release.yml
- [ ] 8.11 Download page
  - done: `/[locale]/desktop-agent` detects the OS, links the latest release assets, shows system requirements and install steps; unsigned-app warning text until signing is done
- [x] 8.12 Signing and auto-update
  - done: updater with signature verification, signing steps wired to CI secrets and documented in `apps/desktop/README.md`
  - needs: H9
  - exists: apps/desktop/README.md

## Stage 9 - Admin and operations
- [ ] 9.1 Admin panel
  - done: users (search, role, suspend), subscriptions, listings moderation, AI status, system health; admin-only
- [ ] 9.2 Audit log
  - done: security-relevant actions (login, role change, refund, export, admin actions) recorded with actor, IP, time; viewable by admins
- [ ] 9.3 Structured logging and request ids
  - done: JSON logs with request id and user id, secrets and PII redacted, tests for redaction
- [ ] 9.4 Error monitoring
  - done: Sentry-compatible hooks in web, api and desktop, enabled only when `SENTRY_DSN` is set; source maps strategy documented
- [ ] 9.5 Health and readiness
  - done: `/health` (liveness) and `/ready` (db, redis, migrations) endpoints; used by Docker healthchecks
- [ ] 9.6 Transactional emails
  - done: welcome, verify, reset, receipt, payment failed, subscription ended, investor contact request, in uz/ru/en with plain-text fallback
- [ ] 9.7 Backups and restore
  - done: scripted Postgres backup and restore with documentation in `docs/RUNBOOK.md`; includes incident checklist and rollback steps
  - exists: docs/RUNBOOK.md, scripts/backup.sh

## Stage 10 - Security and compliance
- [ ] 10.1 HTTP hardening
  - done: strict CORS allowlist, security headers (CSP, HSTS, frame, referrer, permissions), cookies httpOnly/secure/sameSite
- [ ] 10.2 Rate limiting
  - done: Redis-backed limits on auth, AI, upload, export, messaging endpoints; tests
  - exists: apps/api/tests/test_rate_limits.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_rate_limits.py -q
- [ ] 10.3 Upload safety
  - done: size/type limits, content sniffing, randomized storage names, no path traversal, files served with safe headers, optional antivirus hook
  - exists: apps/api/tests/test_upload_safety.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_upload_safety.py -q
- [ ] 10.4 CI security gates
  - done: secret scanning, `npm audit --omit=dev` and `pip-audit` in CI (fail on high severity), dependabot config
  - exists: .github/dependabot.yml
- [ ] 10.5 Personal data features
  - done: export my data, delete my account (with grace period), consent records, cookie/consent banner for analytics; data retention notes in `docs/DATA.md`
  - exists: docs/DATA.md
- [ ] 10.6 Secrets handling review
  - done: no secret is read by web client code or the desktop app; config docs explain rotation of JWT, NEXTAUTH, INTERNAL_API_KEY and the AI key
  - exists: docs/SECRETS.md

## Stage 11 - Quality
- [ ] 11.1 E2E core flows
  - done: Playwright covers signup, login, plan creation with the fake AI, export, language switch, theme switch, pricing toggle
- [ ] 11.2 E2E money flows
  - done: Playwright covers Free limit -> upgrade -> fake checkout -> Pro access -> cancel
- [ ] 11.3 Accessibility
  - done: axe checks on landing, pricing, login, signup, wizard have no serious violations; keyboard navigation and focus order verified
- [ ] 11.4 Performance
  - done: Lighthouse performance and SEO >= 90 on landing and pricing (documented in `docs/QUALITY.md`); images optimized; fonts preloaded
  - exists: docs/QUALITY.md
- [ ] 11.5 Responsive pass
  - done: Playwright screenshots at 375, 768, 1280 px for the main pages show no horizontal scroll or clipped text in uz/ru/en and both themes
- [ ] 11.6 API load smoke
  - done: simple load script for login, plan generation (fake AI) and report endpoints with target latency documented

## Stage 12 - Deployment
- [x] 12.1 Dockerfiles
  - done: production Dockerfiles for web and api (multi-stage, non-root user, healthcheck)
  - exists: apps/web/Dockerfile, apps/api/Dockerfile
- [ ] 12.2 Compose for production
  - done: `docker-compose.prod.yml` with web, api, worker/scheduler, postgres, redis, reverse proxy with TLS; volumes and restart policies; migrations run on deploy
  - exists: docker-compose.prod.yml
- [ ] 12.3 CD workflow
  - done: GitHub Actions builds and pushes images, runs migrations, deploys to staging on main and to production on tag, with manual approval for production
  - exists: .github/workflows/deploy.yml
- [ ] 12.4 Staging environment docs
  - done: `docs/DEPLOY.md` step by step: servers, DNS, TLS, env vars, first deploy, rollback
  - exists: docs/DEPLOY.md
- [ ] 12.5 First staging deploy
  - done: staging reachable, `/ready` green, smoke test script passes against it
  - needs: H10, H11
  - exists: scripts/smoke-staging.mjs

## Stage 13 - Launch and growth
- [ ] 13.1 Demo data and demo account
  - done: seed script creates a demo restaurant plan, accountant data and investor listing; demo login on the landing page (read-only)
- [ ] 13.2 Onboarding
  - done: first-run checklist and short product tour for each role; empty states lead to the next action
- [ ] 13.3 Lead magnet
  - done: free downloadable sample bank-ready plan (PDF) on the landing page, captured with consent
- [ ] 13.4 Support
  - done: contact form with email delivery, help center with 15 FAQs in 3 languages, in-app feedback button
- [ ] 13.5 Changelog and status
  - done: public changelog page and a status page link in the footer
- [ ] 13.6 Investor document
  - done: `docs/INVESTOR.md` in investor order (problem, solution, market, product, revenue model, competition, architecture and security, team, roadmap, financials, ask, use of funds) plus 20 likely investor questions with draft answers based only on facts in this repo; every market or financial figure is `TODO(VERIFY)`
  - exists: docs/INVESTOR.md
  - contains: docs/INVESTOR.md :: TODO(VERIFY)
- [ ] 13.7 Investor PDF on the site
  - done: investor deck/summary PDF generated from the same sources, downloadable and viewable on a page of the site (access rule from DECISIONS)
- [ ] 13.8 Launch gate script
  - done: `scripts/launch-gate.mjs` exits non-zero while any of these is true: tax rules with `verified: false`, `TODO(LEGAL)` or `TODO(DECISION` markers in shipped pages, missing production env vars, payment provider set to fake, AI key missing, Sentry DSN missing
  - exists: scripts/launch-gate.mjs
- [ ] 13.9 Final release candidate
  - done: `FULL=1 node scripts/verify.mjs` green, launch gate green, changelog and version tagged
  - needs: H5, H8, H11, H16
  - cmd: node scripts/launch-gate.mjs

## Human tasks (the loop cannot do these)
- [ ] H1 Google sign-in: create OAuth credentials in Google Cloud Console (redirect `<site>/api/auth/callback/google`), put client id/secret into `.env`
- [ ] H2 Facebook sign-in: create the app in Facebook Developers (redirect `<site>/api/auth/callback/facebook`), complete required app settings, put id/secret into `.env`
- [ ] H3 Email delivery: choose SMTP or Resend, verify your sender domain (SPF/DKIM), put credentials into `.env`
- [ ] H4 AI provider: create the account, set a monthly spending cap, put the key into `apps/api/ai.config.json`
- [ ] H5 Verify every tax and bank rule against official sources, then set `verified: true` and `verified_by` in the YAML files (the code cannot do this for you)
- [ ] H6 Decide the open items in `specs/DECISIONS.md` (monthly/yearly price, refund policy, Free limits, trial, dunning schedule) and update the file
- [ ] H7 Payment provider: pick one that supports your business entity and country, open the merchant account, obtain sandbox keys and webhook secret
- [ ] H8 Legal review by a lawyer: terms, privacy, refund, AI disclaimer, the commission agreement (taking a percentage of customers' revenue needs a clear contract), personal-data storage rules that apply to you
- [ ] H9 Desktop signing: Apple Developer account and Windows code-signing certificate; add the secrets to GitHub Actions
- [ ] H10 Domain, hosting server(s), DNS and TLS
- [ ] H11 Production secrets: JWT_SECRET, NEXTAUTH_SECRET, INTERNAL_API_KEY, database password, payment live keys, AI key, SENTRY_DSN
- [ ] H12 Make sure the legal entity and tax registration needed to receive payments are in place
- [ ] H13 Create the monitoring account (Sentry or equivalent) and uptime monitor
- [ ] H14 Private beta: 10 real restaurant owners/accountants use the product; collect and triage feedback
- [ ] H15 Talk to banks/microfinance lenders and investors; record what they ask for in `docs/INVESTOR.md`
- [ ] H16 Production acceptance: a real small payment end to end, a refund, a backup restore drill, and a manual pass on mobile
