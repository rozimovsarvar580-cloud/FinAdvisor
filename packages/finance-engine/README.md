# FinAdvisor Finance Engine

Reusable Python package for exact financial calculations using `Decimal`.
Install from this directory with `pip install -e ".[dev]"`; run tests with
`pytest`. Financial calculations must be implemented here, never in the UI or
LLM layer. The package includes the tiered annual commission calculation used
by the pricing calculator, loan schedules, capex and payroll estimates, tax
regime comparison, break-even and payback analysis, DSCR, and reverse revenue
calculations. Versioned tax rules are packaged alongside the engine.
