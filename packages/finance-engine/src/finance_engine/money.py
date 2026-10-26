from collections.abc import Iterable
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


def decimal_amount_to_string(amount: Decimal) -> str:
    if not isinstance(amount, Decimal) or not amount.is_finite():
        raise ValueError("Money amount must be a finite Decimal")
    return format(amount.normalize(), "f")


def decimal_to_minor_units(amount: Decimal) -> int:
    if not amount.is_finite():
        raise ValueError("Money amount must be finite")
    return int((amount * ONE_HUNDRED).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def sum_minor_units(amounts: Iterable[int]) -> int:
    total = 0
    for amount in amounts:
        if isinstance(amount, bool) or not isinstance(amount, int):
            raise TypeError("Money minor units must be integers")
        total += amount
    return total


def sum_decimal_amounts(amounts: Iterable[Decimal]) -> Decimal:
    total = ZERO
    for amount in amounts:
        if not isinstance(amount, Decimal) or not amount.is_finite():
            raise ValueError("Money amounts must be finite Decimal values")
        total += amount
    return total


def monthly_recurring_minor_units(amount_minor: int, billing_period: str) -> int:
    if isinstance(amount_minor, bool) or not isinstance(amount_minor, int):
        raise TypeError("Money minor units must be an integer")
    if amount_minor < 0:
        raise ValueError("Recurring amount must be non-negative")
    amount = Decimal(amount_minor)
    if billing_period == "weekly":
        monthly_amount = amount * Decimal(52) / Decimal(12)
    elif billing_period == "monthly":
        monthly_amount = amount
    elif billing_period == "yearly":
        monthly_amount = amount / Decimal(12)
    else:
        raise ValueError("Billing period must be weekly, monthly, or yearly")
    return int(monthly_amount.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def percentage_rate(numerator: int, denominator: int) -> Decimal | None:
    if denominator <= 0:
        return None
    return (Decimal(numerator) * ONE_HUNDRED / Decimal(denominator)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def validate_non_negative(name: str, amount: Decimal) -> None:
    if not amount.is_finite() or amount < ZERO:
        raise ValueError(f"{name} must be a finite, non-negative amount")
