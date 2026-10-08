---
noteId: "04f476f0c30c11f1b92d93b180ce68c9"
tags: []

---

# Web app route tree audit

Audited on 2026-10-08. The route inventory includes every Next.js `page.tsx` page and `route.ts` handler found in either tree. Route groups (such as `(auth)`) are omitted from the exposed URL; `[locale]` and other bracketed segments are dynamic route parameters.

The legacy `apps/web/app` directory is absent on disk and has no tracked files. All 65 discovered routes are in `apps/web/src/app` (46 localized page routes and 19 API handler routes). `keep` means preserve the existing `src/app` route as the source of truth; there are no legacy-only routes to port or obsolete routes to delete. No application code was changed.

| Route | Exists in `apps/web/app` | Exists in `apps/web/src/app` | Decision |
| --- | --- | --- | --- |
| `/[locale]` | No | Yes | keep |
| `/[locale]/about` | No | Yes | keep |
| `/[locale]/accounting` | No | Yes | keep |
| `/[locale]/accounting/daily` | No | Yes | keep |
| `/[locale]/accounting/import` | No | Yes | keep |
| `/[locale]/accounting/inventory` | No | Yes | keep |
| `/[locale]/accounting/loans` | No | Yes | keep |
| `/[locale]/accounting/payroll` | No | Yes | keep |
| `/[locale]/accounting/tax` | No | Yes | keep |
| `/[locale]/admin` | No | Yes | keep |
| `/[locale]/agent` | No | Yes | keep |
| `/[locale]/analysis/[planId]` | No | Yes | keep |
| `/[locale]/app` | No | Yes | keep |
| `/[locale]/app/billing` | No | Yes | keep |
| `/[locale]/app/finadvisor` | No | Yes | keep |
| `/[locale]/app/reports` | No | Yes | keep |
| `/[locale]/app/settings` | No | Yes | keep |
| `/[locale]/calculators` | No | Yes | keep |
| `/[locale]/calculators/[type]` | No | Yes | keep |
| `/[locale]/contact` | No | Yes | keep |
| `/[locale]/dashboard` | No | Yes | keep |
| `/[locale]/dashboard/notifications` | No | Yes | keep |
| `/[locale]/dashboard/onboarding` | No | Yes | keep |
| `/[locale]/dashboard/settings` | No | Yes | keep |
| `/[locale]/desktop-agent` | No | Yes | keep |
| `/[locale]/disclaimer` | No | Yes | keep |
| `/[locale]/download` | No | Yes | keep |
| `/[locale]/faq` | No | Yes | keep |
| `/[locale]/features` | No | Yes | keep |
| `/[locale]/investors` | No | Yes | keep |
| `/[locale]/investors/[listingId]` | No | Yes | keep |
| `/[locale]/investors/inbox` | No | Yes | keep |
| `/[locale]/investors/kyc` | No | Yes | keep |
| `/[locale]/investors/saved` | No | Yes | keep |
| `/[locale]/login` | No | Yes | keep |
| `/[locale]/plans` | No | Yes | keep |
| `/[locale]/plans/[planId]` | No | Yes | keep |
| `/[locale]/plans/new` | No | Yes | keep |
| `/[locale]/pricing` | No | Yes | keep |
| `/[locale]/privacy` | No | Yes | keep |
| `/[locale]/register` | No | Yes | keep |
| `/[locale]/reset-password` | No | Yes | keep |
| `/[locale]/signup` | No | Yes | keep |
| `/[locale]/terms` | No | Yes | keep |
| `/[locale]/wizard` | No | Yes | keep |
| `/[locale]/wizard/steps` | No | Yes | keep |
| `/api/auth/[...nextauth]` | No | Yes | keep |
| `/api/auth/login` | No | Yes | keep |
| `/api/auth/logout` | No | Yes | keep |
| `/api/auth/oauth-role` | No | Yes | keep |
| `/api/auth/password-reset` | No | Yes | keep |
| `/api/auth/register` | No | Yes | keep |
| `/api/auth/verify` | No | Yes | keep |
| `/api/calc/[type]` | No | Yes | keep |
| `/api/chat/stream` | No | Yes | keep |
| `/api/documents/[planId]/[format]` | No | Yes | keep |
| `/api/marketplace/listings` | No | Yes | keep |
| `/api/marketplace/listings/[listingId]` | No | Yes | keep |
| `/api/marketplace/listings/[listingId]/visibility` | No | Yes | keep |
| `/api/plans/analyze` | No | Yes | keep |
| `/api/plans/generate` | No | Yes | keep |
| `/api/plans/generate-and-save` | No | Yes | keep |
| `/api/plans/mine` | No | Yes | keep |
| `/api/pricing/commission` | No | Yes | keep |
| `/api/register` | No | Yes | keep |
