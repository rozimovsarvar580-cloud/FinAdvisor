---
noteId: "72f92001c30811f1b92d93b180ce68c9"
tags: []

---

# Product decisions and defaults

Agents: use the DEFAULT of each decision, mark anything price-, policy- or legal-related with the shown
`TODO(DECISION Dn)` marker, and never present a default as final. The owner (human task H6) edits this file
when real decisions are made; after that, search for the markers and update them.

## D1 Subscription prices (USD)
Weekly is the base price from the product spec.
| Plan | Weekly | Monthly (default = weekly x 4) | Yearly (default = monthly x 12 x 0.8) |
|---|---|---|---|
| Free | 0 | 0 | 0 |
| Pro | 10 | 40 | 384 |
| Business | 20 | 80 | 768 |
Monthly and yearly are placeholders. Marker: `TODO(DECISION D1)`.

## D2 Plan limits (placeholders)
| Limit | Free | Pro | Business |
|---|---|---|---|
| Saved plans | 1 | 10 | 50 |
| AI requests per day | 10 | 100 | 300 |
| Plan analysis uploads per day | 0 | 10 | 30 |
| Calculators | startup cost only | all | all |
| PDF / Excel export | no | yes | yes |
| Desktop agent | no | no | yes |
| Team seats (owner + accountants) | 1 | 1 | 3 |
| Marketplace listing | no | 1 | 5 |
Marker: `TODO(DECISION D2)`.

## D3 Pro vs Business content (from the product spec)
- Pro: AI analysis, credit, tax, revenue, profit, calculators, business plan.
- Business: everything in Pro, Agent-Synergy, Windows/macOS agent, accountant + owner accounts.

## D4 Commission (Business plan, desktop agent)
- Rates are progressive on ANNUAL revenue recorded through the agent: 0-100M UZS: 4%; 100M-1B UZS: 2%;
  above 1B UZS: 1%. Example: 150M gives 100M x 4% + 50M x 2% = 5,000,000 UZS.
- Calendar-year cumulative. Monthly statement = commission(YTD revenue) - commission already billed this year.
- Billed monthly in arrears; the statement shows the calculation and the underlying revenue entries.
- The legal basis (contract text) is pending human task H8. Marker: `TODO(DECISION D4)`.

## D5 Refund policy (placeholder, subject to legal review)
7 days for a first subscription purchase if the product was barely used; commission statements are not
refundable except for calculation errors. Marker: `TODO(DECISION D5)`.

## D6 Failed payments (dunning)
Retry on day 1, 3 and 5 after the failure, send an email each time, 7-day grace period, then downgrade to
Free (data kept). Marker: `TODO(DECISION D6)`.

## D7 Trial
No trial; the Free plan is the trial. Marker: `TODO(DECISION D7)`.

## D8 AI provider
OpenAI, model configurable in `apps/api/ai.config.json`; default `gpt-4o-mini`. The provider sits behind the
`AIProvider` interface so it can be swapped.

## D9 Languages
Locales: uz (Latin script, default), ru, en. Formal register in uz and ru.

## D10 Currency
Subscription prices in USD; business data and commission in UZS. Each invoice stores its own currency and
amount in minor units. Which currency the payment provider charges is decided with H7.

## D11 Investor document access
A public summary page; the full investor PDF is downloadable after leaving an email address (consent recorded).

## D12 Data location
Where personal data must be stored depends on legal advice (H8). Keep the storage layer configurable;
do not hard-code a region. Marker: `TODO(DECISION D12)`.

## D13 Roles
- tadbirkor (owner): own plans, billing, reads accounting data, issues agent commands, lists on marketplace.
- buxgalter (accountant): writes accounting data for the owner's business; no billing, no marketplace.
- investor: browses published listings, contacts owners; never sees accounting data; detailed financials only
  after KYC approval.
- admin: everything operational, audited.

## D14 Design palette: Midnight Indigo + Amber
| Token | Light | Dark |
|---|---|---|
| background | #FAFAFF | #0B0B1A |
| card | #FFFFFF | #14142B |
| foreground | #12122B | #F2F2FF |
| primary (indigo) | #4F46E5 | #8B85FF |
| accent (amber) | #F59E0B | #FBBF24 |
| success | #10B981 | #34D399 |
| border | #E4E4F2 | #26264A |
Brand gradient: linear-gradient(135deg, #4F46E5, #7C3AED 55%, #EC4899), used only on hero and gradient buttons.
Fonts: Plus Jakarta Sans (headings), Inter (body). Store tokens as HSL CSS variables and refer to them
through Tailwind; no hex literals in components.
