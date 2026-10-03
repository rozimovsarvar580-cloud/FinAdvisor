from dataclasses import dataclass
from decimal import Decimal

from finance_engine.money import ZERO, quantize_money, validate_non_negative


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
    formula: str
    inputs: dict[str, str]


@dataclass(frozen=True)
class PayrollLine:
    role: str
    employee_count: int
    monthly_salary: Decimal
    monthly_payroll: Decimal


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


def estimate_payroll(positions: list[StaffPosition]) -> PayrollEstimate:
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
    return PayrollEstimate(
        employee_count=total_employees,
        monthly_payroll=monthly_payroll,
        annual_payroll=quantize_money(monthly_payroll * Decimal(12)),
        positions=tuple(position_results),
        formula="monthly_payroll = sum(employee_count * monthly_salary); "
        "annual_payroll = monthly_payroll * 12",
        inputs={"position_count": str(len(positions)), "employee_count": str(total_employees)},
    )
