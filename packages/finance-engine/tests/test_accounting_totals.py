from decimal import Decimal

from finance_engine.money import accounting_totals


def test_accounting_totals_use_decimal_and_report_profit() -> None:
    totals = accounting_totals(
        [Decimal("100.25"), Decimal(20)],
        [Decimal("30.10")],
        [Decimal(5)],
    )
    assert totals == {
        "revenue": Decimal("120.25"),
        "expenses": Decimal("30.10"),
        "profit": Decimal("90.15"),
        "taxes": Decimal("5.00"),
    }
