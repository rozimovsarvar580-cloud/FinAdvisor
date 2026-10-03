from decimal import Decimal

import pytest

from finance_engine.tax import compare_tax_regimes


def test_tax_comparison_loads_rates_and_provenance_from_versioned_config() -> None:
    result = compare_tax_regimes(Decimal(100000000), Decimal(70000000))
    regimes = {regime.regime: regime for regime in result.regimes}

    assert regimes["turnover_tax"].rate == Decimal("0.04")
    assert regimes["turnover_tax"].tax_amount == Decimal("4000000.00")
    assert regimes["profit_tax"].rate == Decimal("0.15")
    assert regimes["profit_tax"].tax_amount == Decimal("4500000.00")
    assert regimes["profit_tax"].source_url.startswith("https://lex.uz/")
    assert regimes["profit_tax"].effective_from == "2026-01-01"
    assert result.formula


def test_profit_tax_has_zero_base_when_expenses_exceed_revenue() -> None:
    result = compare_tax_regimes(Decimal(100), Decimal(120))
    profit_tax = next(regime for regime in result.regimes if regime.regime == "profit_tax")

    assert result.pretax_profit == Decimal(-20)
    assert profit_tax.taxable_base == Decimal(0)
    assert profit_tax.profit_after_tax == Decimal(-20)


def test_tax_comparison_rejects_negative_revenue() -> None:
    with pytest.raises(ValueError):
        compare_tax_regimes(Decimal(-1), Decimal(0))
