from decimal import Decimal

import pytest

from finance_engine.money import (
    decimal_to_minor_units,
    minor_units_to_decimal_string,
    usd_price_to_minor_units,
)


@pytest.mark.parametrize(
    ("price", "expected"),
    [("$0", 0), ("$10", 1000), ("$20.50", 2050), ("$384.00", 38400)],
)
def test_usd_catalog_prices_convert_exactly_to_minor_units(
    price: str, expected: int
) -> None:
    assert usd_price_to_minor_units(price) == expected


@pytest.mark.parametrize(
    "price",
    ["10", "$-1", "$NaN", "$Infinity", "$1.001", "$1,000", "$"],
)
def test_invalid_usd_catalog_prices_are_rejected(price: str) -> None:
    with pytest.raises(ValueError):
        usd_price_to_minor_units(price)


def test_usd_catalog_price_conversion_uses_decimal_without_float_rounding() -> None:
    assert usd_price_to_minor_units("$0.29") == int(Decimal("0.29") * 100)


@pytest.mark.parametrize(
    ("amount_minor", "expected"),
    [(0, "0.00"), (1, "0.01"), (1000, "10.00"), (-125, "-1.25")],
)
def test_minor_units_format_as_exact_decimal_strings(
    amount_minor: int, expected: str
) -> None:
    assert minor_units_to_decimal_string(amount_minor) == expected


@pytest.mark.parametrize("amount_minor", [True, 1.5, "100"])
def test_minor_units_formatter_rejects_non_integer_values(amount_minor) -> None:
    with pytest.raises(TypeError):
        minor_units_to_decimal_string(amount_minor)


@pytest.mark.parametrize(
    ("amount", "expected"),
    [(Decimal("0"), 0), (Decimal("0.01"), 1), (Decimal("12.34"), 1234), (Decimal("1.235"), 124)],
)
def test_decimal_amounts_convert_to_minor_units_with_half_up_rounding(
    amount: Decimal, expected: int
) -> None:
    assert decimal_to_minor_units(amount) == expected


@pytest.mark.parametrize("amount", [Decimal("NaN"), Decimal("Infinity")])
def test_decimal_minor_unit_conversion_rejects_non_finite_amounts(
    amount: Decimal,
) -> None:
    with pytest.raises(ValueError, match="finite"):
        decimal_to_minor_units(amount)
