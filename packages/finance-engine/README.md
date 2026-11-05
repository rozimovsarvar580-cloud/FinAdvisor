# FinAdvisor Finance Engine

Reusable Python package for exact financial calculations using `Decimal`.
Install from this directory with `pip install -e ".[dev]"`; run tests with
`pytest`. Financial calculations must be implemented here, never in the UI or
LLM layer. The package includes the tiered annual commission calculation used
by the pricing calculator, loan schedules, capex and payroll estimates, tax
regime comparison, break-even and payback analysis, DSCR, and reverse revenue
calculations. Startup cost estimates group owner-entered Decimal prices into
rent deposit, renovation, kitchen equipment, furniture, licenses, initial
stock, marketing, and reserve categories. The editable
`src/finance_engine/startup_cost_catalog.yaml` contains no assumed prices:
entries remain null and marked `TODO(VERIFY)` until sourced. Versioned tax and
startup-cost catalogs are packaged alongside the engine. Loan affordability
compares available monthly cash with every scheduled payment, including the
highest-payment month of a differentiated schedule. Bank product terms remain
explicit `TODO(VERIFY)` placeholders in
`src/finance_engine/bank_products_2026.yaml` until verified against official
sources. Revenue projections accept the operator's daily revenue, operating
days, fixed costs, variable-cost ratio, profit target, and sensitivity changes
as explicit Decimal assumptions, and return daily, weekly, monthly, and yearly
results without supplying hidden defaults.
