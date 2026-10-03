from decimal import Decimal

import pytest

from finance_engine.loans import annuity_schedule, differential_schedule


def test_annuity_schedule_has_fixed_regular_payments_and_closes_balance() -> None:
    result = annuity_schedule(Decimal(1200), Decimal(0), 12)

    assert result.method == "annuity"
    assert len(result.payments) == 12
    assert all(row.payment == Decimal("100.00") for row in result.payments)
    assert result.payments[-1].remaining_balance == Decimal("0.00")
    assert result.total_payment == Decimal("1200.00")
    assert result.formula
    assert result.inputs["principal"] == "1200"


def test_annuity_schedule_calculates_interest_and_adjusts_last_payment() -> None:
    result = annuity_schedule(Decimal(1000), Decimal(12), 12)

    assert result.payments[0].interest == Decimal("10.00")
    assert result.payments[0].payment == result.payments[1].payment
    assert result.payments[-1].remaining_balance == Decimal("0.00")
    assert result.total_interest > Decimal(0)


def test_differential_schedule_reduces_payment_as_balance_falls() -> None:
    result = differential_schedule(Decimal(1200), Decimal(12), 12)

    assert result.payments[0].principal == Decimal("100.00")
    assert result.payments[0].payment > result.payments[1].payment
    assert result.payments[-1].remaining_balance == Decimal("0.00")


def test_zero_principal_produces_zero_payments() -> None:
    result = annuity_schedule(Decimal(0), Decimal(15), 2)

    assert all(row.payment == Decimal(0) for row in result.payments)
    assert result.total_interest == Decimal(0)


@pytest.mark.parametrize(
    ("principal", "rate", "months"),
    [
        (Decimal(-1), Decimal(0), 12),
        (Decimal(1), Decimal(-1), 12),
        (Decimal(1), Decimal(0), 0),
        (Decimal("NaN"), Decimal(0), 12),
    ],
)
def test_loan_schedules_reject_invalid_inputs(
    principal: Decimal, rate: Decimal, months: int
) -> None:
    with pytest.raises(ValueError):
        annuity_schedule(principal, rate, months)
