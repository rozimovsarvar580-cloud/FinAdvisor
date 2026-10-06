"""Deterministic, auditable financial calculations."""

from .credit import CreditInput, CreditScheduleRow, annuity_schedule
from .capex import CapexInput, CapexItem, CapexResult, calculate_capex
from .metrics import (
    BreakEvenInput,
    BreakEvenResult,
    PaybackInput,
    PaybackResult,
    calculate_break_even,
    calculate_payback,
)
from .revenue_profit import (
    RevenueProfitInput,
    RevenueProfitResult,
    RevenueStream,
    calculate_revenue_profit,
)

__all__ = [
    "CreditInput",
    "CreditScheduleRow",
    "annuity_schedule",
    "CapexItem",
    "CapexInput",
    "CapexResult",
    "calculate_capex",
    "RevenueStream",
    "RevenueProfitInput",
    "RevenueProfitResult",
    "calculate_revenue_profit",
    "BreakEvenInput",
    "BreakEvenResult",
    "calculate_break_even",
    "PaybackInput",
    "PaybackResult",
    "calculate_payback",
]
from .capex import CapexInput, CapexResult, calculate_capex
from .credit import (
    CreditInput,
    ReverseCreditInput,
    ReverseCreditResult,
    annuity_schedule,
    reverse_annuity,
)
from .metrics import BreakEvenInput, BreakEvenResult, calculate_break_even
from .revenue_profit import RevenueProfitInput, RevenueProfitResult, calculate_revenue_profit

__all__ = [
    "CapexInput",
    "CapexResult",
    "CreditInput",
    "ReverseCreditInput",
    "ReverseCreditResult",
    "RevenueProfitInput",
    "RevenueProfitResult",
    "BreakEvenInput",
    "BreakEvenResult",
    "calculate_capex",
    "annuity_schedule",
    "reverse_annuity",
    "calculate_break_even",
    "calculate_revenue_profit",
]
