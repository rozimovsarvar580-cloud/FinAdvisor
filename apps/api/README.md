# FinAdvisor API

FastAPI service with SQLAlchemy and Alembic.

Create a virtual environment, install the finance engine with
`pip install -e ..\..\packages\finance-engine`, then install this project with
`pip install -e ".[dev]"`. Run `uvicorn finadvisor_api.main:app --reload` from
`apps/api`. API tests run with `pytest`.

Set `DATABASE_URL` and `JWT_SECRET` from the repository's `.env` file before
starting the service. Apply database migrations from the repository root with
`alembic -c apps/api/alembic.ini upgrade head`.

For AI features, copy `apps/api/ai.config.example.json` to
`apps/api/ai.config.json` and set the server-side provider, API key, and model.
The backend reads this file before falling back to `OPENAI_API_KEY`; the real
config file is git-ignored. Do not put the key in the web app or desktop agent.
AI calls use the `AIProvider` interface with an OpenAI implementation. Provider
timeouts and retryable failures are mapped to `AIClientError`; retry backoff
is bounded, and streamed output is not retried after content has been emitted.
All AI context is sent in an escaped `<untrusted_data>` block, and a system
policy instructs the model to treat its contents as data rather than
instructions. Uploaded documents, user messages, and retrieved references must
remain data and must never be promoted into system instructions.

Authentication routes include `POST /auth/register`, `/auth/login`,
`/auth/refresh`, `/auth/logout`, `/auth/forgot-password`,
`/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification`,
`POST /auth/oauth`, and `GET /auth/me`. OAuth profile exchange is server-only
and requires `X-Internal-Key` to match `INTERNAL_API_KEY`; only a provider-
verified email can link an OAuth account to an existing user. The separate
`/auth/oauth/provider-token` route validates provider access tokens directly.
Configure `EMAIL_PROVIDER=console` for development or `smtp` / `resend` for
delivery, with `EMAIL_FROM`, `NEXTAUTH_URL`, and provider credentials as needed.

`POST /pricing/commission` accepts an annual revenue string and returns a
progressive commission breakdown calculated by `packages/finance-engine`.

Financial calculations are exposed at `POST /calc/{type}` for `annuity`,
`differential`, `capex`, `payroll`, `tax-comparison`, `break-even`, `payback`,
`dscr`, and `reverse-revenue`. Submit monetary and percentage values as decimal
strings; responses include the formula and input values used. The 2026 tax
rules are versioned with their source and effective date in the finance-engine
package.

Business owners can save a plan with `POST /plans/generate-and-save` or its
streaming counterpart, `POST /plans/generate-and-save/stream`. `PUT
/plans/{plan_id}` updates the narrative summary and sections, records a new
revision, and leaves the finance-engine calculations unchanged. Saved-plan
listings and edits are scoped to the authenticated owner.
Owners can inspect `GET /plans/{plan_id}/versions`, restore a prior revision
with `POST /plans/{plan_id}/restore/{version}`, and create an independent copy
with `POST /plans/{plan_id}/duplicate`. `POST /plans/{plan_id}/share` issues a
read-only link token; `DELETE /plans/{plan_id}/share` revokes it. The API stores
only a hash of the token, and `GET /plans/shared/{token}` returns the current
plan without owner controls and with caching disabled.

Plan exports are available at `POST /documents/{plan_id}/pdf` and
`POST /documents/{plan_id}/excel`, with separate `POST
/documents/{plan_id}/bank-pack` and `POST /documents/{plan_id}/synergy`
exports. Send `{ "locale": "uz|ru|en", "plan":
{...} }` using the plan response returned by `POST /plans/generate`; exports
require an authenticated Pro or Business subscription (Agent-Synergy requires
Business) and are generated on demand, not persisted by this API. The localized PDF
includes a cover, summary, market, operations, staffing, risk, and financial
sections, an engine-derived financial chart, and an appendix with assumptions,
startup costs, payroll, and any loan schedule. Noto Sans is bundled under the
SIL Open Font License for Uzbek and Cyrillic text. PDF financial values are
recomputed from the supplied assumptions by the finance engine. The Excel
workbook uses openpyxl for localized assumption, startup cost, payroll,
monthly P&L, loan schedule, and break-even sheets. Its 12-month P&L links the
finance-engine monthly run-rate across the year without modeling growth or
seasonality; formula-linked summary cells point to engine results.

Billing storage is prepared by the `20261018_11` migration. Subscription and
invoice amounts are integer minor units in USD; payment records retain their
currency, while commission ledger amounts are integer minor units in UZS.
Webhook events retain their provider event identity, signature-verification
result, raw payload, and processing state for idempotent handling. Refunds
reference payments and are tracked separately from the original charge.
The `PaymentProvider` contract and `FakePaymentProvider` implement checkout,
webhook verification, cancellation, and refunds. Set `PAYMENT_PROVIDER=fake`
for local development and tests; this simulated provider is rejected in
production. Payments remain disabled when `PAYMENT_PROVIDER=disabled`.
Authenticated business owners can start a weekly paid-plan checkout with
`POST /billing/checkout`, supplying the plan and locale. The API reads the
amount from the shared pricing catalog, persists an incomplete subscription
and open invoice, and returns the provider checkout URL. Monthly and yearly
prices remain unavailable for checkout while they are marked
`TODO(DECISION D1)`. Returning from checkout does not activate the plan;
subscription activation requires verified provider confirmation. Providers
send signed events to `POST /billing/webhook` using the
`X-Webhook-Signature` header. Verified event IDs are idempotent, signed
unrecognized events are retained without billing side effects, and unmatched
invoice events can be retried after checkout data is available. Successful
payment events must match the stored invoice amount and currency; a later
failure event cannot downgrade a succeeded payment.

Business owners can retrieve their current subscription and up to 50 recent
invoices with `GET /billing/summary`. `POST /billing/cancel` schedules
cancellation at the end of the paid period and retains access through that
period. `POST /billing/plan-change` accepts a paid plan and schedules it for
the next renewal; the current plan remains active until the provider sends a
verified `subscription.plan_change_applied` event. The fake provider records
these management requests for local testing. `POST /billing/payment-method`
returns the provider-hosted payment-method update URL when a provider customer
profile is available. Payment-provider-specific execution remains dependent on
human task H7.

An owner may request a full refund for a successful first subscription payment
within seven days at `POST /billing/payments/{payment_id}/refund-request`;
requests require a barely-used attestation and remain pending for administrator
review. `POST /billing/admin/refunds/{refund_id}` is admin-only and records an
approval or denial. Approval schedules cancellation at period end, then sends
an idempotent refund request to the provider. Signed `refund.succeeded` and
`refund.failed` webhook events update the refund and payment ledger; duplicate
events do not change balances. Commission and non-subscription payments are
not eligible. The seven-day and barely-used rules are provisional
`TODO(DECISION D5)` defaults pending legal review; admin approval is required
and the API does not decide whether usage was “barely used.”

Weekly renewals run as a one-shot job with
`python -m finadvisor_api.renewals` from `apps/api`; schedule it hourly in
UTC with the deployment platform's scheduler, rather than starting a scheduler
inside each API worker. It creates one invoice per subscription period and uses
persisted, idempotent provider attempts. Verified payment webhooks advance
periods and apply scheduled plan changes. Failed renewals follow the D6
placeholder schedule (retry on days 1, 3, and 5; downgrade after 7 days;
`TODO(DECISION D6)`) and localized retry emails use the account locale. A real
provider's off-session charge support remains blocked on H7.

The bank pack includes the loan request inputs and finance-engine repayment
schedule, an explicit note when collateral details were not supplied, and the
versioned checklist evidence score. The score is a preparation aid, not a
bank decision or approval. The Agent-Synergy export summarizes only supplied
plan sections and assumptions; it does not add independently verified
business, financial, legal, or operating advice.

`POST /plans/{plan_id}/investor-qa` creates investor questions and draft answers
from the authenticated business owner's saved plan. The response contains 5 to
10 question-and-answer pairs; answers are limited to plan-supplied values, and
malformed or unsupported numeric output is rejected.

`POST /plans/analyze` accepts a multipart document (`file`) and an optional
`locale` (`uz`, `ru`, or `en`). Content is sniffed rather than trusted by
filename; PDF, DOCX, XLSX, and UTF-8 TXT are supported. Uploads are limited to
15 MiB, PDFs to 100 pages, and extracted text to 50,000 characters. XLSX
archives and workbook iteration are separately bounded. Readiness scores use
the versioned `finadvisor_api/data/bank_checklist.yaml`; missing criteria get
AI-generated fixes and draft sections in the requested language. Drafts cannot
introduce numeric values and invalid provider output is rejected. Configure the
server-side AI provider as described above when a document is missing criteria.

The desktop agent API is available at `/agent`: authenticated operators
can register devices, list their own devices and command history, and queue
statement-sync commands. Device and command records are persisted; a sync
command is queued for processing and does not itself read local bank files or
perform financial calculations.

Advisory chat is available at `POST /chat/stream` for authenticated users.
Requests include the locale, question, and optional prepared finance-engine
results or conversation ID. The server retrieves relevant knowledge, classifies
the question intent, and streams an SSE metadata event with the conversation ID,
intent, and source links before the answer. User and assistant turns are stored
in owner-scoped conversations; use `GET /chat/conversations` to list them and
`GET /chat/conversations/{id}` to retrieve a conversation. Financial figures
must come from the supplied prepared calculations, and retrieved material and
conversation history are treated as untrusted data.

The investor marketplace exposes public, owner-published restaurant listings
at `GET /marketplace/listings`. Authenticated business owners can publish a
listing with `POST /marketplace/listings`, view their own listings at
`GET /marketplace/listings/mine`, and change listing visibility through
`PATCH /marketplace/listings/{id}/visibility`. Funding targets are exact UZS
decimal strings supplied by the owner; the API does not calculate or claim
returns, raised amounts, risk ratings, or independent verification.
