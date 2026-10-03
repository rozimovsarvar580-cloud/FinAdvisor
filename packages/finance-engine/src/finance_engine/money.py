from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
ZERO = Decimal(0)
ONE_HUNDRED = Decimal(100)


def quantize_money(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def validate_non_negative(name: str, amount: Decimal) -> None:
    if not amount.is_finite() or amount < ZERO:
        raise ValueError(f"{name} must be a finite, non-negative amount")
