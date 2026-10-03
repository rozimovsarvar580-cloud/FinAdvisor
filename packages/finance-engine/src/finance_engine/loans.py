from dataclasses import dataclass
from decimal import Decimal, localcontext
from typing import Literal

from finance_engine.money import ONE_HUNDRED, ZERO, quantize_money, validate_non_negative

LoanMethod = Literal["annuity", "differential"]


@dataclass(frozen=True)
class LoanPayment:
    month: int
    payment: Decimal
    principal: Decimal
    interest: Decimal
    remaining_balance: Decimal


@dataclass(frozen=True)
class LoanSchedule:
    method: LoanMethod
    principal: Decimal
    annual_interest_rate_percent: Decimal
    term_months: int
    monthly_payment: Decimal
    total_payment: Decimal
    total_interest: Decimal
    payments: tuple[LoanPayment, ...]
    formula: str
    inputs: dict[str, str]


def _validate_loan_inputs(
    principal: Decimal, annual_interest_rate_percent: Decimal, term_months: int
) -> None:
    validate_non_negative("principal", principal)
    validate_non_negative("annual_interest_rate_percent", annual_interest_rate_percent)
    if term_months <= 0:
        raise ValueError("term_months must be greater than zero")


def _schedule_result(
    method: LoanMethod,
    principal: Decimal,
    annual_interest_rate_percent: Decimal,
    term_months: int,
    payments: list[LoanPayment],
    formula: str,
) -> LoanSchedule:
    monthly_payment = payments[0].payment if payments else ZERO
    return LoanSchedule(
        method=method,
        principal=principal,
        annual_interest_rate_percent=annual_interest_rate_percent,
        term_months=term_months,
        monthly_payment=monthly_payment,
        total_payment=sum((row.payment for row in payments), start=ZERO),
        total_interest=sum((row.interest for row in payments), start=ZERO),
        payments=tuple(payments),
        formula=formula,
        inputs={
            "principal": format(principal, "f"),
            "annual_interest_rate_percent": format(annual_interest_rate_percent, "f"),
            "term_months": str(term_months),
        },
    )


def annuity_schedule(
    principal: Decimal, annual_interest_rate_percent: Decimal, term_months: int
) -> LoanSchedule:
    _validate_loan_inputs(principal, annual_interest_rate_percent, term_months)
    monthly_rate = annual_interest_rate_percent / ONE_HUNDRED / Decimal(12)
    with localcontext() as context:
        context.prec = 36
        if principal == ZERO:
            regular_payment = ZERO
        elif monthly_rate == ZERO:
            regular_payment = quantize_money(principal / Decimal(term_months))
        else:
            regular_payment = quantize_money(
                principal
                * monthly_rate
                / (Decimal(1) - (Decimal(1) + monthly_rate) ** (-term_months))
            )

    balance = principal
    payments: list[LoanPayment] = []
    for month in range(1, term_months + 1):
        interest = quantize_money(balance * monthly_rate)
        if month == term_months:
            principal_payment = balance
            payment = quantize_money(principal_payment + interest)
        else:
            payment = regular_payment
            principal_payment = min(balance, payment - interest)
            principal_payment = quantize_money(principal_payment)
        balance = quantize_money(balance - principal_payment)
        payments.append(
            LoanPayment(month, payment, principal_payment, interest, balance)
        )

    return _schedule_result(
        "annuity",
        principal,
        annual_interest_rate_percent,
        term_months,
        payments,
        "payment = principal * monthly_rate / (1 - (1 + monthly_rate)^(-term_months)); "
        "last payment is adjusted to the remaining balance",
    )


def differential_schedule(
    principal: Decimal, annual_interest_rate_percent: Decimal, term_months: int
) -> LoanSchedule:
    _validate_loan_inputs(principal, annual_interest_rate_percent, term_months)
    monthly_rate = annual_interest_rate_percent / ONE_HUNDRED / Decimal(12)
    regular_principal = quantize_money(principal / Decimal(term_months))
    balance = principal
    payments: list[LoanPayment] = []

    for month in range(1, term_months + 1):
        interest = quantize_money(balance * monthly_rate)
        principal_payment = (
            balance
            if month == term_months
            else min(balance, regular_principal)
        )
        payment = quantize_money(principal_payment + interest)
        balance = quantize_money(balance - principal_payment)
        payments.append(
            LoanPayment(month, payment, principal_payment, interest, balance)
        )

    return _schedule_result(
        "differential",
        principal,
        annual_interest_rate_percent,
        term_months,
        payments,
        "principal_payment = principal / term_months; "
        "interest = opening_balance * monthly_rate",
    )
