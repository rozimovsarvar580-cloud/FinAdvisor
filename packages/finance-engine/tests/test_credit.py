from decimal import Decimal

from finance_engine.credit import CreditInput, annuity_schedule


def test_zero_rate_splits_principal():
    rows = annuity_schedule(CreditInput(principal=Decimal(120000), annual_rate=0, months=12))
    assert len(rows) == 12
    assert rows[-1].balance == 0
    assert sum(row.interest for row in rows) == 0


def test_interest_schedule_reduces_balance():
    rows = annuity_schedule(CreditInput(principal=Decimal(100000), annual_rate=24, months=12))
    assert rows[0].interest > 0
    assert rows[-1].balance == 0
