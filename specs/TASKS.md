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
  `cmd: ...` ({{PY}} = python). `node scripts/verify.mjs` always runs too.
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
- [x] 2.9 Hard-coded string audit
  - done: no user-facing literal text left in `apps/web/src/**/*.tsx` (JSX text, placeholder, aria-label, title, alt, toast, zod messages); all moved to uz/ru/en keys
- [x] 2.10 Locale quality test
  - done: Vitest/Node test fails if uz/ru/en key sets differ or if a ru/uz value equals its English value (whitelist for brand names and numbers)
  - exists: apps/web/scripts/test-locales.mjs
  - cmd: node apps/web/scripts/test-locales.mjs
- [x] 2.11 Translation review pass
  - done: uz in Latin script with formal register, ru natural business style; machine-like wording fixed; a short report in `specs/i18n-review.md`
  - exists: specs/i18n-review.md
- [x] 2.12 SEO basics
  - done: per-locale metadata, hreflang, sitemap.xml, robots.txt, Open Graph image, JSON-LD for the product
  - exists: apps/web/src/app/sitemap.ts, apps/web/src/app/robots.ts
  - exists: apps/web/src/app/[locale]/opengraph-image.tsx, apps/web/src/lib/site-metadata.test.ts
  - contains: apps/web/src/lib/site-metadata.ts :: buildProductStructuredData
  - cmd: npm.cmd --workspace apps/web test -- src/lib/site-metadata.test.ts

## Stage 3 - Authentication and accounts
- [x] 3.1 Auth data model
  - done: users (role, email_verified, avatar, locale), oauth_accounts, refresh_tokens, email_tokens (hashed, single-use, expiry) with migrations
  - exists: apps/api/tests/test_auth_data_model.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_data_model.py apps/api/tests/test_migrations.py apps/api/tests/test_migration_chain.py -q
- [x] 3.2 Register, login, refresh, logout
  - done: argon2 passwords, short-lived access token, rotating hashed refresh token, logout revokes; brute-force protection per account and IP
  - exists: apps/api/tests/test_auth_core.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_core.py -q
- [x] 3.3 Email verification and password reset
  - done: endpoints for forgot-password, reset-password, verify-email, resend; tokens single-use, 1h/24h expiry; no user enumeration in responses
  - exists: apps/api/tests/test_auth_email_flows.py, apps/api/tests/test_email_sender.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_email_flows.py apps/api/tests/test_email_sender.py -q
- [x] 3.4 OAuth backend endpoint
  - done: `POST /auth/oauth` finds or creates a user from {provider, provider_account_id, email, name, avatar}; requires header `X-Internal-Key` == INTERNAL_API_KEY; returns tokens, user and `is_new`; links accounts by verified email safely
  - exists: apps/api/tests/test_auth_oauth.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_auth_oauth.py -q
- [x] 3.5 EmailSender
  - done: interface with console implementation (dev) and SMTP/Resend implementation selected by env; templates in uz/ru/en for verify, reset, welcome; tested with a fake
  - exists: apps/api/src/finadvisor_api/email_sender.py
- cmd: {{PY}} -m pytest apps/api/tests/test_email_sender.py -q
- [x] 3.6 NextAuth integration
  - done: Google and Facebook sign-in call `/auth/oauth` with the internal key and put accessToken, role, needsRole into the session; refresh handled; locale-aware sign-in page (no hard-coded /uz/login); types in `next-auth.d.ts`; callbacks tested
- [x] 3.7 Role onboarding
  - done: new OAuth users pick tadbirkor, buxgalter or investor at `/[locale]/onboarding/role` (`PATCH /me`); guarded so it cannot be skipped
- [x] 3.8 Login and signup UI
  - done: two-column layout with animated brand panel; react-hook-form + zod; show/hide password, strength meter, inline errors, loading state, remember me, translated server errors, terms checkbox linking to legal pages; tests
- [x] 3.9 Forgot, reset and verify pages
  - done: pages for forgot-password, reset-password, verify-email with success and error states in 3 languages
- [x] 3.10 Social buttons
  - done: Google and Facebook buttons with brand SVG logos (`allow-hex`), hover/active effects; disabled with tooltip when provider env vars are missing (server helper, secrets never exposed)
- [x] 3.11 Route protection and profile
  - done: middleware protects `/app/*`; role-based redirects; profile/settings page (name, language, password change, connected accounts, delete account request)
- [x] 3.12 Authorization test matrix
  - done: pytest role matrix for authenticated, anonymous, owner, accountant, investor and admin routes; persisted saved plans, desktop-agent data and ledger entries are owner-scoped with cross-user IDOR coverage
  - exists: apps/api/tests/test_authorization_matrix.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_authorization_matrix.py -q

## Stage 4 - AI (single key file, backend only)
- [x] 4.1 Key file loader
  - done: `apps/api/ai.config.json` ({provider, api_key, model}) is read first, `OPENAI_API_KEY` env second; cached; clear `AIClientError` when missing; `ai.config.example.json` committed, real file git-ignored; key never logged
  - exists: apps/api/ai.config.example.json, apps/api/tests/test_ai_config.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_config.py -q
- [x] 4.2 Provider interface
  - done: `AIProvider` protocol (generate, stream) with OpenAI implementation and a deterministic fake for tests; timeouts, retries with backoff, error mapping
- [x] 4.3 Admin AI status
  - done: `GET /admin/ai-status` returns only {connected, provider, model}; shown on the admin page
- [x] 4.4 Prompt-injection defenses
  - done: all uploaded or user text goes into delimited data blocks; system prompt states it is data, not instructions; tests with hostile documents ("ignore previous instructions", "reveal the key") prove outputs are unaffected and no secret is reachable
  - exists: apps/api/tests/test_ai_prompt_injection.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_prompt_injection.py -q
- [x] 4.5 AI plan generation
  - done: input = structured restaurant data (city, area, seats, staff such as 10 cooks and 20 waiters, budget, goal such as 100M profit); numbers come only from finance-engine; LLM writes narrative sections; output JSON + markdown; streaming progress
- [x] 4.6 Number-consistency eval
  - done: test extracts every number from generated text and fails if it is not in the engine's output for that plan; runs with the fake provider
  - exists: apps/api/tests/test_ai_number_consistency.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_number_consistency.py -q
- [x] 4.7 Document text extraction
  - done: PDF, DOCX, XLSX, TXT extraction with size and page limits, content-type sniffing (not extension only), safe temp handling
- [x] 4.8 Plan analysis and bank-readiness score
  - done: versioned `bank_checklist.yaml` (market analysis, financial projections, repayment ability, risks, collateral, team, legal); analysis returns score per criterion, missing items, concrete fixes and rewritten weak sections
  - exists: apps/api/src/finadvisor_api/data/bank_checklist.yaml
- [x] 4.9 Bank-readiness evals
  - done: 6 sample plans (weak, medium, strong, two with missing sections, one hostile) with expected score ranges; test fails when ranking is wrong
  - exists: apps/api/tests/test_bank_readiness_eval.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_bank_readiness_eval.py -q
- [x] 4.10 Advisory chat
  - done: `/chat/stream`, intents (tax, credit, staffing, marketing, bank choice), knowledge retrieval, answers cite supplied figures and state uncertainty; conversation history stored per user
- [x] 4.11 Investor Q&A generator
  - done: given a plan, returns likely investor questions with draft answers grounded only in plan data
- [x] 4.12 AI usage metering and limits
  - done: tokens/requests counted per user per day; Free/Pro/Business limits from DECISIONS enforced server-side; friendly 429 with upgrade hint; admin can see cost per user
  - exists: apps/api/tests/test_ai_limits.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_limits.py -q
- [x] 4.13 AI UI
  - done: FinAdvisor page with chat, plan wizard entry, analyze-my-plan upload, streaming responses, copy/export buttons, loading and error states, disclaimer visible
- [ ] 4.14 Live AI smoke script
  - done: `scripts/ai-smoke.py` makes one real request through the configured key and prints OK or the error; never prints the key
  - needs: H4
  - exists: scripts/ai-smoke.py

## Stage 5 - Finance engine, plans and documents
- [x] 5.1 Golden tests for existing engine
  - done: at least 25 golden tests (known inputs, expected outputs) across tax, loans, payroll, profitability, commission; including commission 150M = 5,000,000 and boundary cases at 100M and 1B
  - exists: packages/finance-engine/tests/test_golden.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_golden.py -q
- [x] 5.2 Startup cost and equipment
  - done: restaurant startup cost model (rent deposit, renovation, kitchen equipment, furniture, licenses, initial stock, marketing, reserve) with editable price tables in versioned YAML marked `TODO(VERIFY)` prices
- [ ] 5.3 Staffing and payroll
  - done: payroll for any role mix (e.g. 10 cooks, 20 waiters, plus manager, cleaner, accountant, cashier, delivery), employer taxes/contributions from the tax YAML, monthly and yearly totals
  - needs: H5
- [x] 5.4 Tax rules with provenance
  - done: `tax_rules_2026.yaml` where every rule has `source_url`, `effective_date`, `verified` (default false) and `verified_by`; test fails if a rule lacks these; UI shows an "estimate" badge while `verified: false`
  - exists: packages/finance-engine/tests/test_tax_rules_provenance.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_tax_rules_provenance.py -q
- [ ] 5.5 Loans
  - done: annuity and differentiated schedules, DSCR, affordability check, bank product table in versioned YAML with source fields like tax rules
  - needs: H5
- [x] 5.6 Revenue, profit, break-even
  - done: daily/weekly/monthly/yearly projections, profit target solver ("what revenue do I need for 100M profit"), break-even, sensitivity table
- [x] 5.7 Calculators API
  - done: one endpoint per calculator with Pydantic schemas, validation of ranges, tests
  - exists: apps/api/tests/test_calculators_api.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_calculators_api.py -q
- [x] 5.8 Calculators UI
  - done: pages for startup cost, payroll, tax, loan, profit/break-even with live results, charts, save-to-plan; mobile friendly
- [x] 5.9 Plan wizard end to end
  - done: wizard -> engine numbers -> AI narrative -> editable plan -> versions -> export; resumable drafts
- [x] 5.10 Excel export
  - done: workbook with assumptions, startup costs, payroll, P&L by month, loan schedule, break-even; real formulas where practical; test opens it with openpyxl
  - exists: apps/api/tests/test_export_xlsx.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_export_xlsx.py -q
- [x] 5.11 PDF business plan
  - done: investor/bank-ready PDF with cover, summary, market, operations, staffing, financials with charts, risks, appendix; uz/ru/en; fonts support Cyrillic and Uzbek characters; test checks page count and text presence
  - exists: apps/api/tests/test_export_pdf.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_export_pdf.py -q
- [x] 5.12 Bank pack and Synergy PDF
  - done: separate "bank pack" PDF (loan request, repayment schedule, collateral section, bank-readiness score) and "Agent-Synergy" PDF (operating strategy)
- [x] 5.13 Downloads in the web UI
  - done: download buttons with progress/error states on the plan page; files named sensibly; export limited by tier
- [x] 5.14 Plan history and sharing
  - done: versions, restore, duplicate; share-link toggle (read-only, revocable)

## Stage 6 - Money: subscriptions, payments, commission
- [x] 6.1 Billing data model
  - done: subscriptions, invoices, payments, payment_events (raw webhook log), commission_ledger, refunds with migrations; money stored as integer minor units with currency
- [x] 6.2 Plan limits middleware
  - done: Free/Pro/Business limits for saved plans, AI requests, plan analysis uploads, calculator access, exports, desktop agent, Agent-Synergy, and marketplace listings are configured centrally and enforced server-side; tests cover tier access, quotas, and authenticated calculator behavior
  - exists: apps/api/tests/test_plan_limits.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_plan_limits.py -q
- [x] 6.3 PaymentProvider interface and fake
  - done: typed `PaymentProvider` contract and development/test fake implement checkout, HMAC webhook verification, cancellation, and refunds; fake use is rejected in production and disabled payments remain unavailable
- [x] 6.4 Checkout flow
  - done: choose plan -> checkout -> success/cancel pages; amount always computed server-side; subscription activates only from a verified webhook
- [x] 6.5 Webhooks done right
  - done: signature verification, idempotency (replayed event changes nothing), out-of-order tolerance, every event stored; tests for forged signature and replay
  - exists: apps/api/tests/test_webhooks.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_webhooks.py -q
- [ ] 6.6 Real payment provider
  - done: implementation for the provider chosen in H7 with sandbox keys from env; contract tests against recorded fixtures
  - needs: H7
- [x] 6.7 Billing page
  - done: current plan, next charge date, invoices list, change plan, cancel (keeps access until period end), update payment method
  - exists: apps/api/tests/test_billing_management.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_billing_management.py -q
- [x] 6.8 Weekly renewals job
  - done: scheduler creates invoices for weekly subscriptions, retries failed payments (dunning schedule from DECISIONS), downgrades after the grace period, emails the user in their language; tested with a fake clock
  - exists: apps/api/tests/test_renewals.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_renewals.py -q
- [x] 6.9 Refunds and cancellations
  - done: refund endpoint and admin action per the refund policy in DECISIONS; ledger stays consistent
  - exists: apps/api/tests/test_refunds.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_refunds.py -q
- [x] 6.10 Commission ledger
  - done: Business accounts' annual revenue recorded through the desktop agent feeds `calculate_progressive_commission`; monthly commission statements generated with the calculation shown; owner can view and dispute; admin can export
  - exists: apps/api/tests/test_commission_ledger.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_commission_ledger.py -q
- [x] 6.11 Admin revenue dashboard
  - done: MRR/weekly revenue, active subscribers per plan, churn, failed payments, commission accrued, AI cost vs revenue per user; CSV export
- [x] 6.12 Funnel analytics
  - done: privacy-friendly first-party events (visit, signup, plan_created, export, checkout_started, paid) stored server-side with consent; admin funnel view

## Stage 7 - Investor marketplace
- [x] 7.1 Listings
  - done: owner publishes a plan as a listing with visibility controls (what financial detail is public, what needs a request); draft/published/archived
- [x] 7.2 Discovery
  - done: search and filters (city, sector, funding amount, stage), pagination, saved listings, saved searches
- [x] 7.3 Contact and messaging
  - done: investor sends a contact request, owner accepts/declines, then threaded messages with email notifications; rate limits
  - exists: apps/api/tests/test_marketplace_messages.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_marketplace_messages.py -q
- [x] 7.4 Investor verification
  - done: investor profile and KYC status flow (submitted, approved, rejected) with admin review; only approved investors see detailed financials
- [x] 7.5 Moderation
  - done: report listing/message, admin review queue, hide/ban actions, audit log entries
- [x] 7.6 Marketplace UI
  - done: investor dashboard, listing page, inbox, owner view of interest; new design system; 3 languages

## Stage 8 - Desktop agent (Windows and macOS)
- [x] 8.1 Accounting API for the agent
  - done: endpoints for inventory, stock movements, sales, expenses, employees with RBAC (accountant writes, owner reads and issues commands, investor denied); idempotent sync endpoints with client ids
  - exists: apps/api/tests/test_accounting_rbac.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_accounting_rbac.py -q
- [x] 8.2 Reports API
  - done: `GET /reports/{day|week|month|year}`: revenue, expenses, profit, taxes, stock in/sold/remaining; Excel and PDF export
- [x] 8.3 Agent commands
  - done: owner issues commands (generate growth plan, generate report, explain this month); stored, executed by backend/AI, results delivered to owner and agent
- [x] 8.4 App shell and login
  - done: Tauri app shell with login against the API, language and theme, same design tokens; session token stored in the OS keychain, never in plain files
- [x] 8.5 Dashboard
  - done: day/week/month/year revenue, profit, taxes, stock overview with charts, offline-friendly
- [x] 8.6 Accountant screens
  - done: inventory in/out, sales entry, expense entry, product catalog; validation and keyboard-friendly forms
- [x] 8.7 Offline and sync
  - done: local SQLite, offline queue, sync with idempotent ids, conflict rule documented (server timestamp wins), sync status indicator; tests for the sync logic
- [x] 8.8 Agent chat and commands UI
  - done: owner chat and command box; AI requests only via the API (the desktop app contains no AI key; test greps the bundle sources)
- [x] 8.9 Bundling and CSP
  - done: bundle targets msi, nsis, dmg enabled; CSP allows only the API origin; app identifier and version set
  - not-contains: apps/desktop/src-tauri/tauri.conf.json :: "active": false
- [x] 8.10 Release workflow
  - done: GitHub Actions matrix (windows-latest, macos-latest) with tauri-action builds installers and attaches them to a GitHub Release on version tags
  - exists: .github/workflows/desktop-release.yml
- [x] 8.11 Download page
  - done: `/[locale]/desktop-agent` detects the OS, links the latest release assets, shows system requirements and install steps; unsigned-app warning text until signing is done
- [ ] 8.12 Signing and auto-update
  - done: updater with signature verification, signing steps wired to CI secrets and documented in `apps/desktop/README.md`
  - needs: H9
  - exists: apps/desktop/README.md

## Stage 9 - Admin and operations
- [x] 9.1 Admin panel
  - done: users (search, role, suspend), subscriptions, listings moderation, AI status, system health; admin-only
- [x] 9.2 Audit log
  - done: security-relevant actions (login, role change, refund, export, admin actions) recorded with actor, IP, time; viewable by admins
- [x] 9.3 Structured logging and request ids
  - done: JSON logs with request id and user id, secrets and PII redacted, tests for redaction
- [x] 9.4 Error monitoring
  - done: Sentry-compatible hooks in web, api and desktop, enabled only when `SENTRY_DSN` is set; source maps strategy documented
- [x] 9.5 Health and readiness
  - done: `/health` (liveness) and `/ready` (db, redis, migrations) endpoints; used by Docker healthchecks
- [x] 9.6 Transactional emails
  - done: welcome, verify, reset, receipt, payment failed, subscription ended, investor contact request, in uz/ru/en with plain-text fallback
- [x] 9.7 Backups and restore
  - done: scripted Postgres backup and restore with documentation in `docs/RUNBOOK.md`; includes incident checklist and rollback steps
  - exists: docs/RUNBOOK.md, scripts/backup.sh

## Stage 10 - Security and compliance
- [x] 10.1 HTTP hardening
  - done: strict CORS allowlist, security headers (CSP, HSTS, frame, referrer, permissions), cookies httpOnly/secure/sameSite
- [x] 10.2 Rate limiting
  - done: Redis-backed limits on auth, AI, upload, export, messaging endpoints; tests
  - exists: apps/api/tests/test_rate_limits.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_rate_limits.py -q
- [x] 10.3 Upload safety
  - done: size/type limits, content sniffing, randomized storage names, no path traversal, files served with safe headers, optional antivirus hook
  - exists: apps/api/tests/test_upload_safety.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_upload_safety.py -q
- [x] 10.4 CI security gates
  - done: secret scanning, `npm audit --omit=dev` and `pip-audit` in CI (fail on high severity), dependabot config
  - exists: .github/dependabot.yml
- [x] 10.5 Personal data features
  - done: export my data, delete my account (with grace period), consent records, cookie/consent banner for analytics; data retention notes in `docs/DATA.md`
  - exists: docs/DATA.md
- [x] 10.6 Secrets handling review
  - done: no secret is read by web client code or the desktop app; config docs explain rotation of JWT, NEXTAUTH, INTERNAL_API_KEY and the AI key
  - exists: docs/SECRETS.md

## Stage 11 - Quality
- [x] 11.1 E2E core flows
  - done: Playwright covers signup, login, plan creation with the fake AI, export, language switch, theme switch, pricing toggle
- [x] 11.2 E2E money flows
  - done: Playwright covers Free limit -> upgrade -> fake checkout -> Pro access -> cancel
- [x] 11.3 Accessibility
  - done: axe checks on landing, pricing, login, signup, wizard have no serious violations; keyboard navigation and focus order verified
- [x] 11.4 Performance
  - done: Lighthouse performance and SEO >= 90 on landing and pricing (documented in `docs/QUALITY.md`); images optimized; fonts preloaded
  - exists: docs/QUALITY.md
- [x] 11.5 Responsive pass
  - done: Playwright screenshots at 375, 768, 1280 px for the main pages show no horizontal scroll or clipped text in uz/ru/en and both themes
- [x] 11.6 API load smoke
  - done: simple load script for login, plan generation (fake AI) and report endpoints with target latency documented

## Stage 12 - Deployment
- [x] 12.1 Dockerfiles
  - done: production Dockerfiles for web and api (multi-stage, non-root user, healthcheck)
  - exists: apps/web/Dockerfile, apps/api/Dockerfile
- [x] 12.2 Compose for production
  - done: `docker-compose.prod.yml` with web, api, worker/scheduler, postgres, redis, reverse proxy with TLS; volumes and restart policies; migrations run on deploy
  - exists: docker-compose.prod.yml
- [x] 12.3 CD workflow
  - done: GitHub Actions builds and pushes images, runs migrations, deploys to staging on main and to production on tag, with manual approval for production
  - exists: .github/workflows/deploy.yml
- [x] 12.4 Staging environment docs
  - done: `docs/DEPLOY.md` step by step: servers, DNS, TLS, env vars, first deploy, rollback
  - exists: docs/DEPLOY.md
- [ ] 12.5 First staging deploy
  - done: staging reachable, `/ready` green, smoke test script passes against it
  - needs: H10, H11
  - exists: scripts/smoke-staging.mjs

## Stage 13 - Launch and growth
- [x] 13.1 Demo data and demo account
  - done: seed script creates a demo restaurant plan, accountant data and investor listing; demo login on the landing page (read-only)
- [x] 13.2 Onboarding
  - done: first-run checklist and short product tour for each role; empty states lead to the next action
- [x] 13.3 Lead magnet
  - done: free downloadable sample bank-ready plan (PDF) on the landing page, captured with consent
- [x] 13.4 Support
  - done: contact form with email delivery, help center with 15 FAQs in 3 languages, in-app feedback button
- [x] 13.5 Changelog and status
  - done: public changelog page and a status page link in the footer
- [x] 13.6 Investor document
  - done: `docs/INVESTOR.md` in investor order (problem, solution, market, product, revenue model, competition, architecture and security, team, roadmap, financials, ask, use of funds) plus 20 likely investor questions with draft answers based only on facts in this repo; every market or financial figure is `TODO(VERIFY)`
  - exists: docs/INVESTOR.md
  - contains: docs/INVESTOR.md :: TODO(VERIFY)
- [x] 13.7 Investor PDF on the site
  - done: investor deck/summary PDF generated from the same sources, downloadable and viewable on a page of the site (access rule from DECISIONS)
- [x] 13.8 Launch gate script
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






# Task additions (inserted into specs/TASKS.md by scripts/add-tasks.mjs; do not edit TASKS.md by hand)

=== URGENT ===
## Stage U - Urgent UI fixes (from screenshots)
- [x] U1 Password field with the show/hide icon INSIDE the input
  - done: new shared `PasswordField` in `apps/web/src/components/auth/password-field.tsx`; the show/hide control is an eye / eye-off ICON BUTTON placed inside the input on the right (no separate "Show password" text next to the field); `type` toggles password/text; the button has a translated aria-label and aria-pressed, is keyboard reachable, keeps focus on the input, causes no layout shift, has hover and focus styles in light and dark; used by login, signup, reset-password and change-password forms; keep the existing visual style of the forms
  - exists: apps/web/src/components/auth/password-field.tsx
  - cmd: cd apps/web && npx vitest run password-field
- [x] U2 Login form order: "Forgot password?" directly below the password field
  - done: order is Email, Password (icon toggle inside), "Forgot password?" link directly below the password field aligned right, then Remember me, then the Log in button, then "Or continue with" and the social buttons; the same tidy order on signup where it applies; tab order follows the visual order; a test asserts the DOM order; keep the existing visual style
  - cmd: cd apps/web && npx vitest run login-form
- [x] U3 Fix "Your choice could not be saved. Please try again." in Analytics preferences
  - done: reproduce first with a failing test, then find the root cause (check the consent endpoint/route, API base URL and CORS, auth required for anonymous visitors, missing table or migration, cookie/storage write, unhandled network errors); Accept and Reject both save for anonymous and signed-in users and the choice survives a reload; if the API is unreachable fall back to a first-party cookie and sync later instead of showing an error; error text translated; the banner never covers page content or buttons at 375, 768 and 1280 px (in the screenshot a rounded bar overlaps the bottom of the features grid: check whether it is this banner); regression tests on both sides
  - max_fails: 6
  - exists: apps/api/tests/test_consent_api.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_consent_api.py -q
  - cmd: cd apps/web && npx vitest run consent
- [x] U4 Replace glyph icons on feature cards with real SVG icons
  - done: feature cards (and any other place using unicode glyph characters as icons) use consistent SVG icons (lucide-react if installed, else inline SVG) with the same size and stroke, token colors in both themes, aria-hidden; cards keep the current style and equal heights
- [x] U5 Repo hygiene: local database and build artifacts
  - done: `finadvisor.db`, other local `*.db`/`*.sqlite` files and `*.tsbuildinfo` are git-ignored and removed from the git index (`git rm --cached`), not deleted from disk; docs say how to recreate the dev database (migrations or seed script)
  - cmd: node -e "const r=require('child_process').execSync('git ls-files').toString();process.exit(/finadvisor\.db|tsbuildinfo/.test(r)?1:0)"

=== STAGES ===
## Stage 14 - All business types (industry-agnostic core)
- [ ] 14.1 Audit restaurant-specific code
  - done: `specs/audit-industry.md` lists every place where restaurant is hard-coded (engine, API schemas, wizard, AI prompts, bank checklist, PDFs/Excel, i18n files, emails, desktop agent, tests) with a decision for each (generalize, keep as sector template, delete); no code changes
  - exists: specs/audit-industry.md
- [ ] 14.2 Sector registry (data, not code)
  - done: versioned YAML definitions, one per sector, loaded by finance-engine: id, names in uz/ru/en, revenue model type, typical cost categories, typical staff roles, inventory/COGS behavior, KPIs, questions to ask the user, optional licenses/regulations to check; initial sectors: restaurant_cafe, retail_shop, online_store, beauty_salon, auto_service, fitness_studio, education_center, food_production, delivery_logistics, it_services, accommodation, construction_repair, generic_other; sector files contain STRUCTURE and labels only; any benchmark, license or regulation entry has `source_url`, `verified: false` and `TODO(VERIFY)`; numbers are never invented
  - exists: packages/finance-engine/tests/test_sectors.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_sectors.py -q
- [ ] 14.3 Driver-based financial model for any business
  - done: finance-engine supports revenue models capacity_utilization (seats/chairs/rooms x turns or occupancy x average ticket), unit_sales (units x price), hourly_service (staff hours x rate x utilization), recurring (subscribers x ARPU with churn) and project_based (projects x average value x conversion), combinable per plan; COGS per unit or percent; opex categories; headcount by role; capex; working capital; seasonality curve; tax regime from the tax YAML; same outputs as today (monthly P&L, cash flow, break-even, loan fit); the current restaurant model becomes the restaurant_cafe template with unchanged results; golden tests for at least 4 different sectors; Decimal only
  - max_fails: 6
  - exists: packages/finance-engine/tests/test_multi_sector_model.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_multi_sector_model.py -q
- [ ] 14.4 Sector-aware API
  - done: `GET /sectors`, `GET /sectors/{id}`; plan creation takes `sector_id` plus free-form `inputs` validated against the sector definition; migration adds sector and inputs to plans and defaults existing plans to restaurant_cafe; backward compatible; tests
  - exists: apps/api/tests/test_sectors_api.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_sectors_api.py -q
- [ ] 14.5 Wizard: "What business is it?"
  - done: first wizard step lets the user pick a sector (cards with icons plus search), "Other" with a short description, and the stage (idea, just starting, already running, want to grow); the next steps are built from the sector definition (roles, costs, revenue drivers) with the user able to add custom roles and cost lines; resumable; uz/ru/en; tests
  - cmd: cd apps/web && npx vitest run sector
- [ ] 14.6 AI that works for any sector
  - done: plan generation, analysis and chat prompts are built from the sector definition and the user's inputs, no restaurant-only language; for "Other" the AI first asks up to 5 clarifying questions and states its assumptions explicitly; the number-consistency eval runs for at least 3 sectors; tests with the fake provider
  - exists: apps/api/tests/test_ai_multi_sector.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_ai_multi_sector.py -q
- [ ] 14.7 Bank checklist and investor Q&A per sector
  - done: `bank_checklist.yaml` keeps a generic base and gains `sector_addons`; sample plans from 3 sectors have expected score ranges; investor questions adapt to the sector
  - exists: apps/api/tests/test_bank_readiness_sectors.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_bank_readiness_sectors.py -q
- [ ] 14.8 Exports for every sector
  - done: PDF, Excel and bank pack derive titles, sections and tables from the plan and sector (no restaurant wording unless the sector is restaurant_cafe); tests for 3 sectors in uz, ru and en
  - exists: apps/api/tests/test_export_multi_sector.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_export_multi_sector.py -q
- [ ] 14.9 Wording sweep and guard
  - done: all landing, pricing, about, wizard, calculators, email, PDF and desktop copy in uz/ru/en is business-neutral ("Plan sections tailored to your business", not "restaurant"); restaurant stays only as one example or sector name; `apps/web/scripts/check-industry-wording.mjs` fails when "restaurant" (and ru/uz equivalents) appears in locale files outside an allowlist of sector keys and examples; wired into `scripts/verify.config.json` extraSteps
  - exists: apps/web/scripts/check-industry-wording.mjs
  - cmd: node apps/web/scripts/check-industry-wording.mjs
- [ ] 14.10 Accounting and desktop agent for goods and services
  - done: items can be goods or services; inventory is optional (service businesses have no stock); custom expense and income categories; units and service durations; migration and tests; desktop screens adapt to the business type
  - exists: apps/api/tests/test_accounting_generic.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_accounting_generic.py -q
- [ ] 14.11 Sector coverage matrix
  - done: a parametrized test runs wizard inputs -> engine -> fake AI plan -> PDF/Excel for EVERY sector in the registry and fails if any sector breaks; a Playwright e2e covers 3 sectors
  - exists: apps/api/tests/test_sector_matrix.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_sector_matrix.py -q
- [ ] 14.12 Marketplace by sector
  - done: listings carry a sector; investors filter and search by sector; tests

## Stage 15 - AI advisors (finance, market, competitors, customers, growth)
- [ ] 15.1 Advisor data model and API skeleton
  - done: tables advisor_reports (user, plan, type, input, output JSON, sources JSON, assumptions JSON, created_at) and advisor_sessions with migrations; endpoints to create, list and read reports; owner-scoped (no IDOR); counted by the AI usage limits (4.12) with advisor limits from DECISIONS D16
  - exists: apps/api/tests/test_advisor_api.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_advisor_api.py -q
- [ ] 15.2 Advisor report schema and renderer
  - done: Pydantic `AdvisorReport` with summary, findings, recommendations (title, why, priority, expected impact, effort, concrete steps, metric to track), assumptions, sources (url, title, retrieved_at), confidence and disclaimers; markdown and PDF renderers in uz/ru/en; tests
  - exists: apps/api/tests/test_advisor_schema.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_advisor_schema.py -q
- [ ] 15.3 Business context builder
  - done: assembles a compact, size-limited JSON context for prompts from the plan, sector definition, user inputs and accounting data when available; flags missing data explicitly so the advisor asks instead of guessing; strips PII; tests
  - exists: apps/api/tests/test_advisor_context.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_advisor_context.py -q
- [ ] 15.4 AI financial advisor (chat and what-if)
  - done: the advisor answers questions about the user's own numbers (cash flow, margins, pricing, debt, taxes, hiring); the LLM may request what-if scenarios but ONLY finance-engine computes them and the results are shown with their inputs; it lists assumptions, asks for missing data, never invents figures, never promises outcomes; streaming; tests with the fake provider
  - max_fails: 6
  - exists: apps/api/tests/test_financial_advisor.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_financial_advisor.py -q
- [ ] 15.5 Financial health check
  - done: finance-engine scores liquidity runway, gross margin, break-even buffer, debt service coverage, payroll ratio and rent ratio with Decimal math; sector benchmark ranges are placeholders marked `TODO(VERIFY)` and `verified: false`; API endpoint; AI explanation in plain language; golden tests
  - exists: packages/finance-engine/tests/test_health_check.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_health_check.py -q
- [ ] 15.6 Budget vs actual and 13-week cash-flow forecast
  - done: engine and API compare planned and real numbers (from accounting data, falling back to plan assumptions) and forecast 13 weeks of cash with best, expected and worst cases; golden tests
  - exists: packages/finance-engine/tests/test_cashflow_forecast.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_cashflow_forecast.py -q
- [ ] 15.7 Pricing and margin analysis
  - done: per product or service margin, price-change what-if, break-even volume and a minimum viable price; engine, API and tests
  - exists: packages/finance-engine/tests/test_pricing_margin.py
  - cmd: {{PY}} -m pytest packages/finance-engine/tests/test_pricing_margin.py -q
- [ ] 15.8 Financial management advice
  - done: combines health check, budget vs actual, forecast and pricing results into a prioritized action list (cut or renegotiate costs, adjust prices, build a cash reserve, loan strategy, tax calendar reminders read from the sourced tax YAML) as an `AdvisorReport`; every recommendation cites the number that triggered it; tests
  - exists: apps/api/tests/test_financial_management_advice.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_financial_management_advice.py -q
- [ ] 15.9 Finance tab UI
  - done: health score card, cash-flow chart with scenarios, budget vs actual table, pricing tool and the advisor chat in one tab; example questions; loading, empty and error states; uz/ru/en; light and dark; mobile
- [ ] 15.10 ResearchProvider (web research, pluggable)
  - done: `ResearchProvider` interface (search, fetch_page) with a fake for tests; a real implementation selected by a `research` section in `apps/api/ai.config.json` ({provider, api_key}); results cached, rate-limited and stored with url and retrieved_at; uses official search/APIs only (no scraping of sites that forbid it); `GET /admin/research-status` returns only connected yes/no; the key is never logged or exposed; tests
  - exists: apps/api/tests/test_research_provider.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_research_provider.py -q
- [ ] 15.11 Market research brief (entering or growing in a market)
  - done: input = sector, location, target customer, offer; output = market overview, demand drivers, customer segments, channels, price ranges seen, regulations to check, risks, opportunities; every external fact or number carries a source (url, retrieved_at) or is labeled as an assumption by a post-processor that enforces this; without a research provider it works from user-provided data and says so; tests
  - max_fails: 6
  - exists: apps/api/tests/test_market_brief.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_market_brief.py -q
- [ ] 15.12 Competitors: data model and discovery
  - done: competitors table and CRUD (name, url, location, offer, price points, strengths, weaknesses, notes, source refs); "suggest competitors" uses the ResearchProvider and the user confirms before anything is saved; tests
  - exists: apps/api/tests/test_competitors_api.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_competitors_api.py -q
- [ ] 15.13 Competitor comparison and "build something better" advice
  - done: comparison matrix of the user's business vs competitors (price, quality, service, location, channels, features) built from user-entered or sourced data; gap analysis and differentiation advice; a prioritized improvement backlog for the product or service (impact, effort, metric); claims about competitors are cited or marked as user-provided; tests
  - exists: apps/api/tests/test_competitor_advice.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_competitor_advice.py -q
- [ ] 15.14 Marketing and go-to-market advisor
  - done: positioning and value proposition, target segments, channel suggestions, marketing budget split computed by finance-engine from user-supplied assumptions (CAC, conversion), 30/60/90-day plan, KPIs; ideas for winning market share are framed as hypotheses to test with a cheap pilot; never promises results; tests including a check that outputs contain no guarantee language
  - exists: apps/api/tests/test_marketing_advisor.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_marketing_advisor.py -q
- [ ] 15.15 Customer feedback collector
  - done: the owner creates a short survey (AI drafts questions, owner edits) in uz/ru/en and shares a public link and QR code; anonymous responses with a privacy notice, spam protection and rate limits; response dashboard; tests
  - exists: apps/api/tests/test_surveys.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_surveys.py -q
- [ ] 15.16 Feedback import and PII scrubbing
  - done: import reviews or comments from pasted text or CSV; phone numbers, emails, names and handles are scrubbed before any text reaches the AI; originals are stored separately with owner-only access; tests
  - exists: apps/api/tests/test_feedback_import.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_feedback_import.py -q
- [ ] 15.17 Feedback analysis: what customers want
  - done: the LLM tags each item (theme, sentiment, request type) in batches against a fixed taxonomy plus free tags; CODE counts and ranks the tags (the LLM never counts); output = top pain points, requests, quick wins and "what customers want" with counts and example quotes; hostile review text such as "ignore previous instructions" has no effect (tests)
  - max_fails: 6
  - exists: apps/api/tests/test_feedback_analysis.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_feedback_analysis.py -q
- [ ] 15.18 Customer-driven improvement advice
  - done: maps feedback themes to product, service, pricing and marketing actions; each has an expected effect labeled as a hypothesis, a cheap way to test it (pilot or A/B) and a metric; links to the competitor gaps where relevant; tests
  - exists: apps/api/tests/test_feedback_advice.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_feedback_advice.py -q
- [ ] 15.19 Growth plan synthesizer
  - done: combines finance, market, competitor and feedback reports into a 90-day plan with two modes ("start a business": validation checklist then launch plan; "grow my business"); action checklist with dates, owners and metrics; progress tracking and a weekly review; ties into Agent-Synergy; tests
  - exists: apps/api/tests/test_growth_plan.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_growth_plan.py -q
- [ ] 15.20 Advisor hub UI
  - done: page with tabs Finance, Market, Competitors, Customers and Growth plan; guided flows with example prompts; sources and assumptions panel on every report; history; export to PDF and Markdown; streaming and error states; plan-limit hints with upgrade links; uz/ru/en; light and dark; mobile; keyboard accessible
- [ ] 15.21 Advisor evals and safety
  - done: tests prove (a) numbers in outputs come from the engine or user data, (b) external facts have a source or an assumption label, (c) prompt injection through reviews, competitor pages and uploads has no effect, (d) PII never reaches the provider, (e) no guaranteed-results wording; 5 golden scenarios across at least 4 sectors
  - exists: apps/api/tests/test_advisor_evals.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_advisor_evals.py -q
- [ ] 15.22 Advisor knowledge base
  - done: versioned markdown topics (financial management, pricing, marketing basics, customer research methods, competitor analysis) in uz/ru/en with retrieval tests; local-specific claims carry `TODO(VERIFY)`
  - exists: apps/api/tests/test_advisor_knowledge.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_advisor_knowledge.py -q
- [ ] 15.23 Advisor in the desktop agent
  - done: owner commands "weekly health check", "competitor update" and "customer feedback summary" run through the existing command mechanism and show results in the agent; tests
- [ ] 15.24 Live research smoke script
  - done: `scripts/research-smoke.py` makes one real research request through the configured provider and prints OK or the error; never prints the key
  - needs: H17
  - exists: scripts/research-smoke.py

## Stage 16 - Growth and polish
- [ ] 16.1 Goal-based onboarding
  - done: after signup the user picks a goal (start a business, grow my business, get a loan, invest) and gets a tailored first-run checklist and dashboard; skippable; uz/ru/en
- [ ] 16.2 Owner home: business health dashboard
  - done: health score, cash runway, margin trend, alerts and the single next best action, using the health check and advisor reports; empty state for new users
- [ ] 16.3 Data import templates
  - done: downloadable Excel/CSV templates for sales, expenses and inventory; validated import with a row-by-row error report; tests
  - exists: apps/api/tests/test_data_import.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_data_import.py -q
- [ ] 16.4 Team invites
  - done: owners invite accountants by email link with the right role; seat limits per plan from DECISIONS; revoke access; tests
  - exists: apps/api/tests/test_team_invites.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_team_invites.py -q
- [ ] 16.5 Weekly digest email
  - done: opt-in weekly email to owners with the health score and top 3 actions in their language; scheduled job tested with a fake clock; one-click unsubscribe
  - exists: apps/api/tests/test_weekly_digest.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_weekly_digest.py -q
- [ ] 16.6 Notifier with Telegram channel (optional)
  - done: `Notifier` interface with email and Telegram implementations selected by env; owners can link Telegram and receive the digest and alerts; disabled cleanly when no bot token is configured; tests with a fake
  - exists: apps/api/tests/test_notifier.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_notifier.py -q
- [ ] 16.7 Plain-language glossary and "explain this number"
  - done: tooltips for financial terms in uz/ru/en; every key figure has an "Explain this number" panel built from the engine's calculation steps (no AI needed), with an optional AI rephrase
- [ ] 16.8 Number, currency and date formatting
  - done: one shared formatter for UZS and USD amounts, percentages and dates per locale (for example 1 000 000 so'm), used everywhere including PDFs, Excel and emails; tests; no raw floats shown to users
  - exists: apps/web/src/lib/format.test.ts
  - cmd: cd apps/web && npx vitest run format
- [ ] 16.9 Sector landing pages for search traffic
  - done: `/[locale]/business-plan/[sector]` pages generated from the sector registry with example inputs clearly labeled as examples, a CTA into the wizard, JSON-LD, sitemap entries and per-locale metadata; no invented statistics
  - exists: apps/web/src/app/[locale]/business-plan/[sector]/page.tsx
- [ ] 16.10 Referral program
  - done: each user has a referral code; when a referred business becomes a paying customer both get free days per DECISIONS D17; abuse protection and a ledger entry per reward; tests
  - exists: apps/api/tests/test_referrals.py
  - cmd: {{PY}} -m pytest apps/api/tests/test_referrals.py -q
- [ ] 16.11 PWA basics
  - done: web app manifest, icons, install prompt and an offline fallback page; Lighthouse PWA basics pass
- [x] 16.12 Launch gate: advisors and sector data
  - done: `scripts/launch-gate.mjs` also fails while any sector YAML item has `verified: false`, advisor knowledge still contains `TODO(VERIFY)`, or the research provider is the fake
  - needs: 13.8
  - contains: scripts/launch-gate.mjs :: verified

=== HUMAN ===
- [ ] H17 Research provider: choose a web-search/research API, create the account, add the key to the `research` section of `apps/api/ai.config.json`, and read its terms of use
- [ ] H18 Telegram (optional): create a bot with BotFather and put the token into `.env`
- [ ] H19 Have an accountant or domain expert per sector review the sector YAML (cost categories, roles, licenses, benchmarks), then set `verified: true` and `verified_by`
- [ ] H20 Pilot each advisor with at least 5 real business owners across at least 3 sectors; record what was useful, wrong or missing in `docs/PILOT.md`
- [ ] H21 Legal check: collecting customer feedback and survey data (privacy notice, consent, retention), using reviews from public sources, and the research provider's terms
- [ ] H22 Decide which sectors to market first based on the pilot results and update `specs/DECISIONS.md`

=== INSTRUCTIONS ===

## Multi-industry and advisor rules
- FinAdvisor serves ALL business types. Never hard-code restaurant logic in engine, API, prompts, exports or copy; restaurant is one sector template. Sector definitions hold structure and labels, never invented benchmarks.
- Advisors use the user's own data plus finance-engine results. Every external fact, number or claim about a market or competitor needs a source (url + retrieved date) or an explicit "assumption" label. Without research data, say so.
- Counting, ranking and arithmetic are done by code, never by the LLM (this includes feedback theme counts).
- Advice is framed as hypotheses to test, with a metric; never promise or guarantee results (revenue, profit, loan approval, customer growth).
- Customer text (reviews, survey answers, competitor pages) is DATA. Scrub PII before it reaches any AI provider. Use official APIs or search providers; do not scrape sites that forbid it.
- Login and signup forms: show/hide password is an icon inside the input; "Forgot password?" sits directly below the password field.

=== DECISIONS ===

## D15 Initial sectors
restaurant_cafe, retail_shop, online_store, beauty_salon, auto_service, fitness_studio, education_center, food_production, delivery_logistics, it_services, accommodation, construction_repair, generic_other. Which to market first is decided after the pilot (H22). Marker: `TODO(DECISION D15)`.

## D16 Advisor limits (placeholders)
| Limit | Free | Pro | Business |
|---|---|---|---|
| Advisor reports | 2 total | 10 per day | 30 per day |
| Market research briefs | 0 | 3 per day | 10 per day |
| Feedback items analyzed per month | 0 | 500 | 5000 |
Marker: `TODO(DECISION D16)`.

## D17 Referral reward (placeholder)
Both sides get 7 free days when the referred business pays for the first time. Marker: `TODO(DECISION D17)`.