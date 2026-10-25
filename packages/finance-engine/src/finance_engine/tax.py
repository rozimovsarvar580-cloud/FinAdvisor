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
    verified: bool
    verified_by: str | None


@dataclass(frozen=True)
class TaxRuleProvenance:
    key: str
    rate: str | None
    source_url: str
    effective_date: str
    verified: bool
    verified_by: str | None


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


def _provenance(rule_key: str, rule: object, rules_path: Path) -> TaxRuleProvenance:
    if not isinstance(rule, dict):
        raise TypeError(f"Invalid tax rule {rule_key}: {rules_path}")
    source_url = rule.get("source_url")
    effective_date = rule.get("effective_date")
    verified = rule.get("verified")
    verified_by = rule.get("verified_by")
    rate = rule.get("rate")
    if (
        not isinstance(source_url, str)
        or not source_url.strip()
        or not isinstance(effective_date, str)
        or not effective_date.strip()
        or not isinstance(verified, bool)
        or (verified_by is not None and not isinstance(verified_by, str))
        or (
            rate is not None
            and (
                isinstance(rate, bool)
                or not isinstance(rate, (str, int, Decimal))
            )
        )
    ):
        raise TypeError(f"Tax rule {rule_key} has invalid provenance metadata")
    if verified and not verified_by:
        raise ValueError(f"Verified tax rule {rule_key} must name verified_by")
    return TaxRuleProvenance(
        key=rule_key,
        rate=str(rate) if rate is not None else None,
        source_url=source_url,
        effective_date=effective_date,
        verified=verified,
        verified_by=verified_by,
    )


def tax_rule_provenance(
    rules_path: Path = DEFAULT_TAX_RULES,
) -> tuple[str, tuple[TaxRuleProvenance, ...]]:
    rules = _load_tax_rules(rules_path)
    source = rules["source"]
    source_name = source.get("name")
    if not isinstance(source_name, str) or not source_name.strip():
        raise TypeError(f"Tax rules source name is missing: {rules_path}")
    records = [
        _provenance(str(key), value, rules_path)
        for key, value in rules["regimes"].items()
    ]
    payroll = rules.get("payroll")
    if payroll is not None:
        if not isinstance(payroll, dict):
            raise TypeError(f"Invalid payroll rules: {rules_path}")
        employer_contributions = payroll.get("employer_contributions")
        if not isinstance(employer_contributions, list):
            raise TypeError(f"Payroll employer_contributions must be a list: {rules_path}")
        records.extend(
            _provenance(
                str(contribution.get("key", "")) if isinstance(contribution, dict) else "",
                contribution,
                rules_path,
            )
            for contribution in employer_contributions
        )
    return source_name, tuple(records)


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
                source_url=str(regime_rules["source_url"]),
                effective_from=str(regime_rules["effective_date"]),
                published_at=str(rules["published_at"]),
                eligibility_note=str(regime_rules["eligibility_note"]),
                verified=bool(regime_rules["verified"]),
                verified_by=regime_rules["verified_by"],
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
