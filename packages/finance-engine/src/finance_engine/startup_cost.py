"""Restaurant startup-cost estimates using owner-editable Decimal inputs."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from finance_engine.money import ZERO, quantize_money, validate_non_negative

StartupCostCategory = Literal[
    "rent_deposit",
    "renovation",
    "kitchen_equipment",
    "furniture",
    "licenses",
    "initial_stock",
    "marketing",
    "reserve",
]

STARTUP_COST_CATEGORIES: tuple[StartupCostCategory, ...] = (
    "rent_deposit",
    "renovation",
    "kitchen_equipment",
    "furniture",
    "licenses",
    "initial_stock",
    "marketing",
    "reserve",
)


@dataclass(frozen=True)
class StartupCostItem:
    category: StartupCostCategory
    name: str
    quantity: Decimal
    unit_cost: Decimal


@dataclass(frozen=True)
class StartupCostLine:
    category: StartupCostCategory
    name: str
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal


@dataclass(frozen=True)
class StartupCostEstimate:
    items: tuple[StartupCostLine, ...]
    category_totals: dict[StartupCostCategory, Decimal]
    total_cost: Decimal
    formula: str
    inputs: dict[str, str]


def estimate_startup_cost(items: list[StartupCostItem]) -> StartupCostEstimate:
    lines: list[StartupCostLine] = []
    category_totals = {category: ZERO for category in STARTUP_COST_CATEGORIES}

    for item in items:
        if item.category not in STARTUP_COST_CATEGORIES:
            raise ValueError(f"Unsupported startup cost category: {item.category}")
        if not item.name.strip():
            raise ValueError("Startup cost item name must not be empty")
        validate_non_negative(f"{item.name}.quantity", item.quantity)
        validate_non_negative(f"{item.name}.unit_cost", item.unit_cost)
        total_cost = quantize_money(item.quantity * item.unit_cost)
        category_totals[item.category] += total_cost
        lines.append(
            StartupCostLine(
                category=item.category,
                name=item.name,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                total_cost=total_cost,
            )
        )

    category_totals = {
        category: quantize_money(amount)
        for category, amount in category_totals.items()
    }
    return StartupCostEstimate(
        items=tuple(lines),
        category_totals=category_totals,
        total_cost=sum(category_totals.values(), start=ZERO),
        formula="item_total = quantity * unit_cost; startup_cost = sum(item_total)",
        inputs={"item_count": str(len(items))},
    )
