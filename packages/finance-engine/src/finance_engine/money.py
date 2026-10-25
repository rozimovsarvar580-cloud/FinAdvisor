from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CENT = Decimal("0.01")
ZERO = Decimal(0)
ONE_HUNDRED = Decimal(100)


def quantize_money(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def usd_price_to_minor_units(price: str) -> int:
    if not isinstance(price, str) or not price.startswith("$"):
        raise ValueError("USD catalog price must start with '$'")
    try:
        amount = Decimal(price[1:])
    except InvalidOperation as error:
        raise ValueError("USD catalog price must be a decimal amount") from error
    if not amount.is_finite() or amount < ZERO:
        raise ValueError("USD catalog price must be finite and non-negative")
    minor_units = amount * Decimal(100)
    if minor_units != minor_units.to_integral_value():
        raise ValueError("USD catalog price cannot have fractions of a cent")
    return int(minor_units)


def minor_units_to_decimal_string(amount_minor: int) -> str:
    if isinstance(amount_minor, bool) or not isinstance(amount_minor, int):
        raise TypeError("Money minor units must be an integer")
    return format(Decimal(amount_minor).scaleb(-2), ".2f")


def decimal_to_minor_units(amount: Decimal) -> int:
    if not amount.is_finite():
        raise ValueError("Money amount must be finite")
    return int((amount * ONE_HUNDRED).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def validate_non_negative(name: str, amount: Decimal) -> None:
    if not amount.is_finite() or amount < ZERO:
        raise ValueError(f"{name} must be a finite, non-negative amount")
