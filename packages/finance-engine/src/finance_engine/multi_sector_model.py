"""Driver-based monthly financial model for businesses across sectors."""

from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Literal, TypeAlias

from finance_engine.loans import (
    LoanAffordabilityResult,
    LoanSchedule,
    annuity_schedule,
    check_loan_affordability,
)
from finance_engine.money import ONE_HUNDRED, ZERO, quantize_money, validate_non_negative
from finance_engine.tax import DEFAULT_TAX_RULES, TaxRegimeResult, compare_tax_regimes


@dataclass(frozen=True)
class CapacityUtilizationRevenue:
    name: str
    capacity_units: Decimal
    turns_or_occupancy_per_day: Decimal
    operating_days_per_month: int
    utilization_percent: Decimal
    average_ticket: Decimal


@dataclass(frozen=True)
class UnitSalesRevenue:
    name: str
    units_per_month: Decimal
    price_per_unit: Decimal


@dataclass(frozen=True)
class HourlyServiceRevenue:
    name: str
    staff_hours_per_month: Decimal
    rate_per_hour: Decimal
    utilization_percent: Decimal


@dataclass(frozen=True)
class RecurringRevenue:
    name: str
    starting_subscribers: Decimal
    average_revenue_per_user: Decimal
    monthly_churn_percent: Decimal
    new_subscribers_per_month: Decimal = ZERO


@dataclass(frozen=True)
class ProjectBasedRevenue:
    name: str
    project_opportunities_per_month: Decimal
    average_project_value: Decimal
    conversion_percent: Decimal


RevenueDriver: TypeAlias = (
    CapacityUtilizationRevenue
    | UnitSalesRevenue
    | HourlyServiceRevenue
    | RecurringRevenue
    | ProjectBasedRevenue
)


@dataclass(frozen=True)
class CostOfGoods:
    name: str
    basis: Literal["per_unit", "percent_of_revenue"]
    amount: Decimal
    units_per_month: Decimal | None = None


@dataclass(frozen=True)
class OperatingExpense:
    category: str
    monthly_amount: Decimal


@dataclass(frozen=True)
class HeadcountCost:
    role: str
    employee_count: int
    monthly_salary: Decimal


@dataclass(frozen=True)
class CapitalExpense:
    name: str
    quantity: int
    unit_cost: Decimal


@dataclass(frozen=True)
class LoanRequest:
    principal: Decimal
    annual_interest_rate_percent: Decimal
    term_months: int


@dataclass(frozen=True)
class MultiSectorModelInput:
    revenue_drivers: tuple[RevenueDriver, ...]
    cost_of_goods: tuple[CostOfGoods, ...] = ()
    operating_expenses: tuple[OperatingExpense, ...] = ()
    headcount: tuple[HeadcountCost, ...] = ()
    capital_expenses: tuple[CapitalExpense, ...] = ()
    working_capital: Decimal = ZERO
    seasonality: tuple[Decimal, ...] = (Decimal(1),) * 12
    tax_regime: str | None = None
    loan: LoanRequest | None = None


@dataclass(frozen=True)
class MonthlyProfitAndLoss:
    month: int
    revenue: Decimal
    cost_of_goods: Decimal
    operating_expenses: Decimal
    payroll: Decimal
    operating_profit: Decimal
    taxes: Decimal
    net_profit: Decimal


@dataclass(frozen=True)
class MonthlyCashFlow:
    month: int
    opening_cash: Decimal
    operating_cash_flow: Decimal
    loan_proceeds: Decimal
    capital_expenses: Decimal
    working_capital: Decimal
    debt_service: Decimal
    net_cash_flow: Decimal
    closing_cash: Decimal


@dataclass(frozen=True)
class BreakEvenAnalysis:
    monthly_break_even_revenue: Decimal | None
    contribution_margin_ratio: Decimal | None
    formula: str


@dataclass(frozen=True)
class MultiSectorModelResult:
    monthly_profit_and_loss: tuple[MonthlyProfitAndLoss, ...]
    monthly_cash_flow: tuple[MonthlyCashFlow, ...]
    break_even: BreakEvenAnalysis
    tax: TaxRegimeResult | None
    loan_schedule: LoanSchedule | None
    loan_fit: LoanAffordabilityResult | None
    monthly_revenue_by_stream: dict[str, tuple[Decimal, ...]]
    formula: str


def _validate_percent(name: str, amount: Decimal) -> None:
    validate_non_negative(name, amount)
    if amount > ONE_HUNDRED:
        raise ValueError(f"{name} must not exceed 100")


def _validate_count(name: str, amount: int, *, minimum: int = 0) -> None:
    if isinstance(amount, bool) or not isinstance(amount, int) or amount < minimum:
        raise ValueError(f"{name} must be an integer of at least {minimum}")


def _validate_driver(driver: RevenueDriver) -> None:
    if not driver.name.strip():
        raise ValueError("Revenue driver name must not be empty")
    if isinstance(driver, CapacityUtilizationRevenue):
        validate_non_negative("capacity_units", driver.capacity_units)
        validate_non_negative("turns_or_occupancy_per_day", driver.turns_or_occupancy_per_day)
        _validate_count("operating_days_per_month", driver.operating_days_per_month, minimum=1)
        if driver.operating_days_per_month > 31:
            raise ValueError("operating_days_per_month must not exceed 31")
        _validate_percent("utilization_percent", driver.utilization_percent)
        validate_non_negative("average_ticket", driver.average_ticket)
    elif isinstance(driver, UnitSalesRevenue):
        validate_non_negative("units_per_month", driver.units_per_month)
        validate_non_negative("price_per_unit", driver.price_per_unit)
    elif isinstance(driver, HourlyServiceRevenue):
        validate_non_negative("staff_hours_per_month", driver.staff_hours_per_month)
        validate_non_negative("rate_per_hour", driver.rate_per_hour)
        _validate_percent("utilization_percent", driver.utilization_percent)
    elif isinstance(driver, RecurringRevenue):
        validate_non_negative("starting_subscribers", driver.starting_subscribers)
        validate_non_negative("average_revenue_per_user", driver.average_revenue_per_user)
        _validate_percent("monthly_churn_percent", driver.monthly_churn_percent)
        validate_non_negative("new_subscribers_per_month", driver.new_subscribers_per_month)
    elif isinstance(driver, ProjectBasedRevenue):
        validate_non_negative(
            "project_opportunities_per_month", driver.project_opportunities_per_month
        )
        validate_non_negative("average_project_value", driver.average_project_value)
        _validate_percent("conversion_percent", driver.conversion_percent)
    else:
        raise TypeError(f"Unsupported revenue driver: {type(driver).__name__}")


def _driver_monthly_amount(driver: RevenueDriver) -> tuple[Decimal, Decimal]:
    if isinstance(driver, CapacityUtilizationRevenue):
        units = (
            driver.capacity_units
            * driver.turns_or_occupancy_per_day
            * Decimal(driver.operating_days_per_month)
            * driver.utilization_percent
            / ONE_HUNDRED
        )
        return units * driver.average_ticket, units
    if isinstance(driver, UnitSalesRevenue):
        return driver.units_per_month * driver.price_per_unit, driver.units_per_month
    if isinstance(driver, HourlyServiceRevenue):
        units = driver.staff_hours_per_month * driver.utilization_percent / ONE_HUNDRED
        return units * driver.rate_per_hour, units
    if isinstance(driver, ProjectBasedRevenue):
        units = driver.project_opportunities_per_month * driver.conversion_percent / ONE_HUNDRED
        return units * driver.average_project_value, units
    raise TypeError("Recurring revenues require a monthly subscriber roll-forward")


def _allocate_tax(
    result: TaxRegimeResult | None,
    profits: list[Decimal],
    revenues: list[Decimal],
) -> list[Decimal]:
    if result is None:
        return [ZERO] * 12
    if result.taxable_base == ZERO:
        return [ZERO] * 12
    weights = (
        [max(profit, ZERO) for profit in profits] if result.regime == "profit_tax" else revenues
    )
    weight_total = sum(weights, ZERO)
    if weight_total == ZERO:
        raise ValueError(f"Cannot allocate tax for regime {result.regime}")
    rounded_tax = quantize_money(result.tax_amount)
    allocations = [quantize_money(rounded_tax * weight / weight_total) for weight in weights[:11]]
    allocations.append(rounded_tax - sum(allocations, ZERO))
    return allocations


def calculate_multi_sector_model(
    data: MultiSectorModelInput,
    *,
    tax_rules_path: Path = DEFAULT_TAX_RULES,
) -> MultiSectorModelResult:
    """Project a twelve-month business plan using Decimal-based revenue drivers."""
    if not data.revenue_drivers:
        raise ValueError("At least one revenue driver is required")
    if len(data.seasonality) != 12:
        raise ValueError("seasonality must contain exactly 12 monthly factors")
    for factor in data.seasonality:
        validate_non_negative("seasonality factor", factor)
    validate_non_negative("working_capital", data.working_capital)

    names: set[str] = set()
    driver_amounts: dict[str, list[Decimal]] = {}
    for driver in data.revenue_drivers:
        _validate_driver(driver)
        if driver.name in names:
            raise ValueError(f"Revenue driver names must be unique: {driver.name}")
        names.add(driver.name)
        driver_amounts[driver.name] = []
        if isinstance(driver, RecurringRevenue):
            subscribers = driver.starting_subscribers
            for factor in data.seasonality:
                driver_amounts[driver.name].append(
                    subscribers * driver.average_revenue_per_user * factor
                )
                subscribers = (
                    subscribers * (Decimal(1) - driver.monthly_churn_percent / ONE_HUNDRED)
                    + driver.new_subscribers_per_month
                )
        else:
            monthly_amount, _ = _driver_monthly_amount(driver)
            for factor in data.seasonality:
                driver_amounts[driver.name].append(monthly_amount * factor)

    for item in data.cost_of_goods:
        if not item.name.strip():
            raise ValueError("Cost-of-goods name must not be empty")
        validate_non_negative(f"{item.name}.amount", item.amount)
        if item.basis == "per_unit":
            if item.units_per_month is None:
                raise ValueError(f"{item.name}.units_per_month is required for per_unit COGS")
            validate_non_negative(f"{item.name}.units_per_month", item.units_per_month)
        elif item.basis == "percent_of_revenue":
            if item.units_per_month is not None:
                raise ValueError(f"{item.name}.units_per_month is only valid for per_unit COGS")
        else:
            raise ValueError(f"Unsupported COGS basis: {item.basis}")
    for expense in data.operating_expenses:
        if not expense.category.strip():
            raise ValueError("Operating expense category must not be empty")
        validate_non_negative(f"{expense.category}.monthly_amount", expense.monthly_amount)
    for position in data.headcount:
        if not position.role.strip():
            raise ValueError("Headcount role must not be empty")
        _validate_count(f"{position.role}.employee_count", position.employee_count)
        validate_non_negative(f"{position.role}.monthly_salary", position.monthly_salary)
    for item in data.capital_expenses:
        if not item.name.strip():
            raise ValueError("Capital expense name must not be empty")
        _validate_count(f"{item.name}.quantity", item.quantity)
        validate_non_negative(f"{item.name}.unit_cost", item.unit_cost)

    if data.loan is not None:
        validate_non_negative("loan.principal", data.loan.principal)
        validate_non_negative(
            "loan.annual_interest_rate_percent",
            data.loan.annual_interest_rate_percent,
        )
        _validate_count("loan.term_months", data.loan.term_months, minimum=1)
        if data.loan.principal == ZERO:
            raise ValueError("loan.principal must be greater than zero")

    revenues = [
        sum((amount[month] for amount in driver_amounts.values()), ZERO) for month in range(12)
    ]
    cogs_by_month: list[Decimal] = []
    for month, revenue in enumerate(revenues):
        cogs = ZERO
        for item in data.cost_of_goods:
            if item.basis == "percent_of_revenue":
                cogs += revenue * item.amount / ONE_HUNDRED
            else:
                if item.units_per_month is None:
                    raise ValueError(f"{item.name}.units_per_month is required for per_unit COGS")
                cogs += item.units_per_month * data.seasonality[month] * item.amount
        cogs_by_month.append(cogs)

    monthly_opex = sum((item.monthly_amount for item in data.operating_expenses), ZERO)
    monthly_payroll = sum(
        (Decimal(position.employee_count) * position.monthly_salary for position in data.headcount),
        ZERO,
    )
    profits = [
        revenues[month] - cogs_by_month[month] - monthly_opex - monthly_payroll
        for month in range(12)
    ]

    tax_result: TaxRegimeResult | None = None
    if data.tax_regime is not None:
        comparison = compare_tax_regimes(
            sum(revenues, ZERO),
            sum(
                (cogs_by_month[month] + monthly_opex + monthly_payroll for month in range(12)),
                ZERO,
            ),
            tax_rules_path,
        )
        tax_result = next(
            (regime for regime in comparison.regimes if regime.regime == data.tax_regime),
            None,
        )
        if tax_result is None:
            raise ValueError(f"Unknown tax regime: {data.tax_regime}")
    taxes = _allocate_tax(tax_result, profits, revenues)

    pnl = tuple(
        MonthlyProfitAndLoss(
            month=month + 1,
            revenue=quantize_money(revenues[month]),
            cost_of_goods=quantize_money(cogs_by_month[month]),
            operating_expenses=quantize_money(monthly_opex),
            payroll=quantize_money(monthly_payroll),
            operating_profit=quantize_money(profits[month]),
            taxes=quantize_money(taxes[month]),
            net_profit=quantize_money(profits[month] - taxes[month]),
        )
        for month in range(12)
    )

    total_revenue = sum(revenues, ZERO)
    total_variable_costs = sum(cogs_by_month, ZERO)
    contribution_margin = (
        None
        if total_revenue == ZERO and total_variable_costs > ZERO
        else (
            Decimal(1)
            if total_revenue == ZERO
            else Decimal(1) - total_variable_costs / total_revenue
        )
    )
    fixed_costs = monthly_opex + monthly_payroll
    break_even_revenue = (
        None
        if contribution_margin is None or contribution_margin <= ZERO
        else quantize_money(fixed_costs / contribution_margin)
    )
    break_even_result = BreakEvenAnalysis(
        monthly_break_even_revenue=break_even_revenue,
        contribution_margin_ratio=contribution_margin,
        formula=(
            "monthly_break_even_revenue = monthly_fixed_costs / "
            "(1 - annual_cost_of_goods / annual_revenue); unavailable when "
            "contribution margin is not positive"
        ),
    )

    loan_schedule: LoanSchedule | None = None
    loan_fit: LoanAffordabilityResult | None = None
    if data.loan is not None:
        loan_schedule = annuity_schedule(
            data.loan.principal,
            data.loan.annual_interest_rate_percent,
            data.loan.term_months,
        )
        available_cash = min(
            (row.net_profit for row in pnl),
            default=ZERO,
        )
        loan_fit = check_loan_affordability(available_cash, loan_schedule)

    capex_total = sum(
        (Decimal(item.quantity) * item.unit_cost for item in data.capital_expenses),
        ZERO,
    )
    cash_flows: list[MonthlyCashFlow] = []
    closing_cash = ZERO
    for month, row in enumerate(pnl):
        opening_cash = closing_cash
        proceeds = data.loan.principal if data.loan is not None and month == 0 else ZERO
        capex = capex_total if month == 0 else ZERO
        working_capital = data.working_capital if month == 0 else ZERO
        debt_service = (
            loan_schedule.payments[month].payment
            if loan_schedule is not None and month < len(loan_schedule.payments)
            else ZERO
        )
        operating_cash = row.net_profit
        net_cash = operating_cash + proceeds - capex - working_capital - debt_service
        closing_cash = opening_cash + net_cash
        cash_flows.append(
            MonthlyCashFlow(
                month=month + 1,
                opening_cash=quantize_money(opening_cash),
                operating_cash_flow=quantize_money(operating_cash),
                loan_proceeds=quantize_money(proceeds),
                capital_expenses=quantize_money(capex),
                working_capital=quantize_money(working_capital),
                debt_service=quantize_money(debt_service),
                net_cash_flow=quantize_money(net_cash),
                closing_cash=quantize_money(closing_cash),
            )
        )

    return MultiSectorModelResult(
        monthly_profit_and_loss=pnl,
        monthly_cash_flow=tuple(cash_flows),
        break_even=break_even_result,
        tax=tax_result,
        loan_schedule=loan_schedule,
        loan_fit=loan_fit,
        monthly_revenue_by_stream={
            name: tuple(quantize_money(amount) for amount in amounts)
            for name, amounts in driver_amounts.items()
        },
        formula=(
            "revenue = sum(monthly driver revenue * seasonality); "
            "operating_profit = revenue - COGS - operating_expenses - payroll; "
            "net_cash_flow = after_tax_operating_profit + loan_proceeds - capex - "
            "working_capital - debt_service"
        ),
    )
