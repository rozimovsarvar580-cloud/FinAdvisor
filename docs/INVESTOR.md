---
noteId: "8ee811b0de8b11f1abb4ff87b16d0aef"
tags: []

---

# FinAdvisor — Investor Brief (Draft)

This draft is based only on facts and product decisions recorded in this repository. It is not a
market study, financial forecast, offer to invest, or legal document. Market, financial, team, and
fundraising claims marked `TODO(VERIFY)` must be substantiated by the founders before external use.

## 1. Problem

FinAdvisor is aimed at small-business owners in Uzbekistan, initially restaurants. The product
hypothesis is that owners need a more organized way to develop business plans, inspect financial
assumptions, prepare information for lender review, maintain accounting records, and communicate
with potential investors. These needs are described in the product specification; the repository
does not contain independent customer research or quantified evidence of demand (`TODO(VERIFY)`).

## 2. Solution

FinAdvisor combines business-plan workflows, deterministic financial calculations, accounting
features, bank-readiness analysis, and an investor marketplace. The finance engine calculates from
user-supplied inputs; AI may explain supplied results or draft narrative, but does not calculate or
invent financial figures. FinAdvisor does not promise loan approval, investment, or business
outcomes.

## 3. Market

- Initial geography and audience: small businesses in Uzbekistan, starting with restaurants.
- Total addressable market, serviceable market, obtainable market, restaurant counts, business
  formation rates, and growth rates: `TODO(VERIFY)`. No sourced market-size figures are present in
  the repository.
- Customer segments, willingness to pay, and adoption assumptions require interviews and validation
  with restaurant owners, accountants, lenders, and investors (`TODO(VERIFY)`).

## 4. Product

The repository currently includes:

- A localized web application in Uzbek, Russian, and English.
- Business-plan creation and analysis, reports, and calculators backed by the finance engine.
- Accounting workflows and a Windows/macOS desktop agent for Business-plan workflows.
- Investor listings and owner-to-investor communication, with investor access rules that distinguish
  published information from detailed financials.
- A read-only demo account and a consented sample-plan download.

The product is implemented as a Next.js web app, FastAPI service, Python finance engine, and Tauri
desktop agent. See [PRODUCT.md](./PRODUCT.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) for the
repository's product and implementation descriptions.

## 5. Revenue model

The current product configuration defines these weekly subscription prices. Verify that the values
are approved and current before sharing them externally:

| Plan | Configured weekly price |
| --- | --- |
| Free | $0 (`TODO(VERIFY)`) |
| Pro | $10/week (`TODO(VERIFY)`) |
| Business | $20/week (`TODO(VERIFY)`) |

Monthly and yearly prices are placeholders, not approved prices (`TODO(DECISION D1)`). Plan limits
are also placeholders (`TODO(DECISION D2)`). The product decision file describes a progressive
commission on annual revenue recorded through the Business desktop agent: 0–100M UZS at 4%,
100M–1B UZS at 2%, and revenue above 1B UZS at 1%. These thresholds and rates are configured
defaults that require verification before external use (`TODO(VERIFY)`); the legal basis and
contract language remain unresolved (`TODO(DECISION D4)`, human task H8). Subscription prices are
specified in USD, while business data and commission are in UZS.

## 6. Competition

No verified competitor research, named competitor set, feature comparison, or pricing comparison is
present in the repository. Competitor identities, positioning, alternatives, and differentiation
must be researched and sourced before making comparative claims (`TODO(VERIFY)`). The product's
stated approach is to combine deterministic financial calculations with business-planning and
accounting workflows; the repository does not establish that this is unique.

## 7. Architecture and security

The API connects the web and desktop clients to persistence and the finance engine. Financial
calculations use Python `Decimal` in the finance-engine package. AI is accessed from the backend
behind an `AIProvider` interface; the provider key is not intended for web-client or desktop use.
Production deployment configuration includes web and API containers, PostgreSQL, Redis, a reverse
proxy, and a deployment workflow.

Implemented controls described in the repository include role-based authorization, owner-scoped
resource access, signed and idempotent payment webhook handling, rate limits, upload validation,
security headers, and secret-handling guidance. These are implementation notes, not an independent
security certification. The repository also documents unresolved data inventory and retention
questions, including webhook payloads that are not currently scoped to an owner. A qualified legal
review and a security assessment are still needed before launch (`TODO(LEGAL)`).

See [ARCHITECTURE.md](./ARCHITECTURE.md), [SECRETS.md](./SECRETS.md), and [DATA.md](./DATA.md).

## 8. Team

The repository does not document founder identities, team size, operating roles, relevant experience,
or hiring plans. Add verified biographies and role descriptions before external distribution
(`TODO(VERIFY)`).

## 9. Roadmap

The repository roadmap records demo access, onboarding, a consented lead magnet, support, and a
changelog/status page as completed product tasks. The listed next launch tasks include an investor
document PDF, a launch-gate script, and a final release candidate. Staging deployment, signing,
production configuration, legal review, customer validation, and production acceptance still depend
on the human tasks in [TASKS.md](../specs/TASKS.md). Roadmap completion is not evidence of
commercial traction or production availability.

## 10. Financials

No verified revenue, paying-customer count, subscription conversion, churn, customer acquisition
cost, lifetime value, operating expense, burn rate, runway, or forecast is documented
(`TODO(VERIFY)`). Do not infer these from configured prices or demo data. Build a sourced operating
model and reconcile it to actual billing and accounting records before presenting financial
projections (`TODO(VERIFY)`).

The configured subscription prices and commission defaults are listed in “Revenue model”; they are
not revenue results or a forecast. Monthly and yearly subscription prices remain placeholders
(`TODO(DECISION D1)`).

## 11. Ask

Funding amount, instrument, valuation, target close date, and any proposed investor rights are not
specified in the repository. Define and substantiate each item before making an ask
(`TODO(VERIFY)`). No investment offer is made by this draft.

## 12. Use of funds

No approved budget, allocation, hiring plan, or use-of-funds schedule is documented. Add each
proposed allocation, amount, timeline, and measurable milestone only after founder approval and
financial validation (`TODO(VERIFY)`). Do not treat this section as an approved budget.

## Likely investor questions

1. **What problem is FinAdvisor addressing?**  
   It is designed to help small-business owners, initially restaurant owners in Uzbekistan, organize
   business plans, financial assumptions, accounting workflows, and investor communication. The
   size and frequency of these pains still need customer validation (`TODO(VERIFY)`).

2. **Who is the initial customer?**  
   The documented starting audience is small businesses in Uzbekistan, with an initial focus on
   restaurants. The repository does not establish a validated customer profile or segment size
   (`TODO(VERIFY)`).

3. **How large is the market?**  
   No sourced market-size estimate is available. Any TAM/SAM/SOM or customer-count estimate is
   `TODO(VERIFY)`.

4. **Why start in Uzbekistan and with restaurants?**  
   The product specification names Uzbekistan and restaurants as the starting scope. A market-entry
   rationale supported by customer interviews or external research is `TODO(VERIFY)`.

5. **What does the product do today?**  
   The repository contains business-plan workflows, finance-engine calculations, accounting
   features, reports, an investor marketplace, and a desktop agent. Actual adoption and production
   use are not established here (`TODO(VERIFY)`).

6. **How are financial results calculated?**  
   The Python finance engine uses `Decimal` and takes user-provided assumptions. AI is used for
   explanatory prose, not to calculate or invent financial figures.

7. **Does FinAdvisor guarantee a loan or investment?**  
   No. The product helps organize information; lenders and investors make their own decisions, and
   no outcome is guaranteed.

8. **What traction has the company achieved?**  
   No verified users, active businesses, paying customers, retention, or revenue metrics are
   documented. Each is `TODO(VERIFY)`.

9. **How has customer demand been validated?**  
   The repository roadmap calls for a private beta and conversations with restaurant owners,
   accountants, banks, and investors. Completed interviews or results are not documented
   (`TODO(VERIFY)`).

10. **How does the company make money?**  
    The configured model combines weekly Free, Pro, and Business subscriptions with a progressive
    commission on annual revenue recorded through the Business desktop agent. The configured
    amounts and rates require verification (`TODO(VERIFY)`); commission contract terms remain
    pending legal review (`TODO(DECISION D4)`).

11. **What are the subscription prices?**  
    The current product configuration lists Free at $0, Pro at $10 per week, and Business at $20 per
    week; verify each before external use (`TODO(VERIFY)`). Monthly and yearly prices are
    placeholders (`TODO(DECISION D1)`).

12. **How does the revenue commission work?**  
    The current decision default applies progressive annual tiers to revenue recorded through the
    Business desktop agent. The configured thresholds and rates are listed in “Revenue model” and
    require verification (`TODO(VERIFY)`); the legal basis and contract require human review
    (`TODO(DECISION D4)`).

13. **Who are the competitors?**  
    No verified competitor list or comparison is available in the repository. This research is
    `TODO(VERIFY)`; no claim of uniqueness is made.

14. **What is the product's defensibility?**  
    The repository describes an integrated workflow and deterministic calculation engine, but does
    not demonstrate a durable moat, proprietary dataset, or unique market position
    (`TODO(VERIFY)`).

15. **How is user data protected?**  
    The implementation documents server-side authorization, owner-scoped lookups, secret boundaries,
    upload controls, and security headers. An independent security assessment and complete legal
    data review are not documented (`TODO(VERIFY)`, `TODO(LEGAL)`).

16. **What do the financial projections look like?**  
    No verified operating model or forecast is present. Revenue, costs, margins, cash needs, and
    forecast assumptions are all `TODO(VERIFY)`.

17. **What legal or regulatory work remains?**  
    The roadmap identifies legal review of terms, privacy, refunds, commission contracts, and data
    location, as well as verification of tax and bank information. These are unresolved human tasks
    (`TODO(LEGAL)`, `TODO(VERIFY)`).

18. **Who is on the team?**  
    Founder and team biographies are not documented in this repository. Names, roles, and experience
    are `TODO(VERIFY)`.

19. **How much funding is being raised and how will it be used?**  
    No approved amount, instrument, valuation, budget, or allocation is documented. All are
    `TODO(VERIFY)`.

20. **What are the main risks before launch?**  
    Repository-listed dependencies include legal and tax verification, payment-provider and
    production configuration, staging deployment, customer validation, and production acceptance.
    Their completion and timing must be confirmed before external claims (`TODO(VERIFY)`).
