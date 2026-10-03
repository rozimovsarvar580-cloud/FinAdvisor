from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

import yaml

from finance_engine.money import ZERO, validate_non_negative

DEFAULT_TAX_RULES = Path(__file__).with_name("tax_rules_2026.yaml")


@dataclass(frozen=True)
class TaxRegimeResult:
    regime: str
    taxable_base: Decimal
    rate: Decimal
    tax_amount: Decimal
    profit_after_tax: Decimal
    source_article: str
    source_name: str
    source_url: str
    effective_from: str
    published_at: str
    eligibility_note: str


@dataclass(frozen=True)
class TaxComparison:
    annual_revenue: Decimal
    annual_expenses: Decimal
    pretax_profit: Decimal
    regimes: tuple[TaxRegimeResult, ...]
    formula: str
    inputs: dict[str, str]


def _load_tax_rules(rules_path: Path) -> dict[str, Any]:
    with rules_path.open(encoding="utf-8") as rules_file:
        rules = yaml.safe_load(rules_file)
    if not isinstance(rules, dict) or not isinstance(rules.get("regimes"), dict):
        raise TypeError(f"Invalid tax rules configuration: {rules_path}")
    if not isinstance(rules.get("source"), dict):
        raise TypeError(f"Tax rules source metadata is missing: {rules_path}")
    return rules


def compare_tax_regimes(
    annual_revenue: Decimal,
    annual_expenses: Decimal,
    rules_path: Path = DEFAULT_TAX_RULES,
) -> TaxComparison:
    validate_non_negative("annual_revenue", annual_revenue)
    validate_non_negative("annual_expenses", annual_expenses)
    rules = _load_tax_rules(rules_path)
    source = rules["source"]
    pretax_profit = annual_revenue - annual_expenses
    regimes: list[TaxRegimeResult] = []

    for regime_name, regime_rules in rules["regimes"].items():
        if not isinstance(regime_rules, dict):
            raise TypeError(f"Invalid rules for tax regime: {regime_name}")
        rate = Decimal(str(regime_rules["rate"]))
        validate_non_negative(f"{regime_name}.rate", rate)
        if rate > Decimal(1):
            raise ValueError(f"{regime_name}.rate must not exceed 100%")
        base_type = regime_rules["base"]
        if base_type == "annual_revenue":
            taxable_base = annual_revenue
        elif base_type == "positive_taxable_profit":
            taxable_base = max(pretax_profit, ZERO)
        else:
            raise ValueError(f"Unsupported tax base for regime: {regime_name}")

        tax_amount = taxable_base * rate
        regimes.append(
            TaxRegimeResult(
                regime=regime_name,
                taxable_base=taxable_base,
                rate=rate,
                tax_amount=tax_amount,
                profit_after_tax=pretax_profit - tax_amount,
                source_article=str(regime_rules["source_article"]),
                source_name=str(source["name"]),
                source_url=str(source["url"]),
                effective_from=str(rules["effective_from"]),
                published_at=str(rules["published_at"]),
                eligibility_note=str(regime_rules["eligibility_note"]),
            )
        )

    return TaxComparison(
        annual_revenue=annual_revenue,
        annual_expenses=annual_expenses,
        pretax_profit=pretax_profit,
        regimes=tuple(regimes),
        formula="turnover tax = revenue * configured rate; "
        "profit tax = max(revenue - expenses, 0) * configured rate",
        inputs={
            "annual_revenue": format(annual_revenue, "f"),
            "annual_expenses": format(annual_expenses, "f"),
            "tax_rules_file": rules_path.name,
        },
    )
