from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

import yaml

from finance_engine.money import ZERO, quantize_money, validate_non_negative

DEFAULT_TAX_RULES = Path(__file__).with_name("tax_rules_2026.yaml")


@dataclass(frozen=True)
class CapexItem:
    name: str
    quantity: Decimal
    unit_cost: Decimal


@dataclass(frozen=True)
class CapexLine:
    name: str
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal


@dataclass(frozen=True)
class CapexEstimate:
    items: tuple[CapexLine, ...]
    total_cost: Decimal
    formula: str
    inputs: dict[str, str]


@dataclass(frozen=True)
class StaffPosition:
    role: str
    employee_count: int
    monthly_salary: Decimal


@dataclass(frozen=True)
class PayrollEstimate:
    employee_count: int
    monthly_payroll: Decimal
    annual_payroll: Decimal
    positions: tuple["PayrollLine", ...]
    employer_contributions: tuple["PayrollContributionLine", ...]
    monthly_employer_contributions: Decimal | None
    annual_employer_contributions: Decimal | None
    monthly_total_employer_cost: Decimal | None
    annual_total_employer_cost: Decimal | None
    contributions_complete: bool
    contributions_verified: bool
    formula: str
    inputs: dict[str, str]


@dataclass(frozen=True)
class PayrollLine:
    role: str
    employee_count: int
    monthly_salary: Decimal
    monthly_payroll: Decimal


@dataclass(frozen=True)
class PayrollContributionLine:
    key: str
    rate: Decimal | None
    monthly_amount: Decimal | None
    annual_amount: Decimal | None
    source_url: str
    effective_date: str
    verified: bool


def estimate_capex(items: list[CapexItem]) -> CapexEstimate:
    lines: list[CapexLine] = []
    for item in items:
        validate_non_negative(f"{item.name}.quantity", item.quantity)
        validate_non_negative(f"{item.name}.unit_cost", item.unit_cost)
        total_cost = quantize_money(item.quantity * item.unit_cost)
        lines.append(CapexLine(item.name, item.quantity, item.unit_cost, total_cost))
    return CapexEstimate(
        items=tuple(lines),
        total_cost=sum((line.total_cost for line in lines), start=ZERO),
        formula="item_total = quantity * unit_cost; capex = sum(item_total)",
        inputs={"item_count": str(len(items))},
    )


def _load_employer_contributions(
    rules_path: Path,
) -> list[dict[str, object]]:
    with rules_path.open(encoding="utf-8") as rules_file:
        rules = yaml.safe_load(rules_file)
    if not isinstance(rules, dict):
        raise TypeError(f"Invalid tax rules configuration: {rules_path}")
    payroll = rules.get("payroll")
    contributions = (
        payroll.get("employer_contributions") if isinstance(payroll, dict) else None
    )
    if not isinstance(contributions, list):
        raise TypeError(f"Payroll employer_contributions must be a list: {rules_path}")
    parsed: list[dict[str, object]] = []
    for contribution in contributions:
        if not isinstance(contribution, dict):
            raise TypeError(f"Invalid payroll contribution rule: {rules_path}")
        key = contribution.get("key")
        rate = contribution.get("rate")
        source_url = contribution.get("source_url")
        effective_date = contribution.get("effective_date")
        verified = contribution.get("verified")
        if (
            not isinstance(key, str)
            or not key.strip()
            or not isinstance(source_url, str)
            or not isinstance(effective_date, str)
            or not isinstance(verified, bool)
        ):
            raise TypeError(f"Invalid payroll contribution metadata: {rules_path}")
        if rate is not None and (
            isinstance(rate, bool) or not isinstance(rate, (str, int, Decimal))
        ):
            raise TypeError(f"Invalid payroll contribution rate: {key}")
        parsed.append(contribution)
    return parsed


def estimate_payroll(
    positions: list[StaffPosition],
    tax_rules_path: Path = DEFAULT_TAX_RULES,
) -> PayrollEstimate:
    position_results: list[PayrollLine] = []
    total_employees = 0
    monthly_payroll = ZERO
    for position in positions:
        validate_non_negative(f"{position.role}.monthly_salary", position.monthly_salary)
        if position.employee_count < 0:
            raise ValueError(f"{position.role}.employee_count must not be negative")
        role_payroll = quantize_money(
            position.monthly_salary * Decimal(position.employee_count)
        )
        total_employees += position.employee_count
        monthly_payroll += role_payroll
        position_results.append(
            PayrollLine(
                position.role,
                position.employee_count,
                position.monthly_salary,
                role_payroll,
            )
        )
    monthly_payroll = quantize_money(monthly_payroll)
    contribution_lines: list[PayrollContributionLine] = []
    rules = _load_employer_contributions(tax_rules_path)
    contributions_complete = bool(rules)
    contributions_verified = bool(rules)
    monthly_contributions = ZERO
    for rule in rules:
        raw_rate = rule["rate"]
        if raw_rate is None:
            rate = None
            monthly_amount = None
            annual_amount = None
            contributions_complete = False
            contributions_verified = False
        else:
            rate = Decimal(str(raw_rate))
            validate_non_negative(f"{rule['key']}.rate", rate)
            if rate > Decimal(100):
                raise ValueError(f"{rule['key']}.rate must not exceed 100%")
            monthly_amount = quantize_money(monthly_payroll * rate / Decimal(100))
            annual_amount = quantize_money(monthly_amount * Decimal(12))
            monthly_contributions += monthly_amount
            contributions_verified = contributions_verified and bool(rule["verified"])
        contribution_lines.append(
            PayrollContributionLine(
                key=str(rule["key"]),
                rate=rate,
                monthly_amount=monthly_amount,
                annual_amount=annual_amount,
                source_url=str(rule["source_url"]),
                effective_date=str(rule["effective_date"]),
                verified=bool(rule["verified"]),
            )
        )
    if not contributions_complete:
        monthly_employer_contributions = None
        annual_employer_contributions = None
        monthly_total_employer_cost = None
        annual_total_employer_cost = None
    else:
        monthly_employer_contributions = quantize_money(monthly_contributions)
        annual_employer_contributions = quantize_money(
            monthly_employer_contributions * Decimal(12)
        )
        monthly_total_employer_cost = quantize_money(
            monthly_payroll + monthly_employer_contributions
        )
        annual_total_employer_cost = quantize_money(
            monthly_total_employer_cost * Decimal(12)
        )
    return PayrollEstimate(
        employee_count=total_employees,
        monthly_payroll=monthly_payroll,
        annual_payroll=quantize_money(monthly_payroll * Decimal(12)),
        positions=tuple(position_results),
        employer_contributions=tuple(contribution_lines),
        monthly_employer_contributions=monthly_employer_contributions,
        annual_employer_contributions=annual_employer_contributions,
        monthly_total_employer_cost=monthly_total_employer_cost,
        annual_total_employer_cost=annual_total_employer_cost,
        contributions_complete=contributions_complete,
        contributions_verified=contributions_verified,
        formula="monthly_payroll = sum(employee_count * monthly_salary); "
        "employer_contribution = monthly_payroll * configured_rate / 100; "
        "annual_total_employer_cost = monthly_total_employer_cost * 12",
        inputs={"position_count": str(len(positions)), "employee_count": str(total_employees)},
    )
