from decimal import Decimal
from pathlib import Path

import pytest
import yaml

from finance_engine.startup_cost import (
    STARTUP_COST_CATEGORIES,
    StartupCostItem,
    estimate_startup_cost,
)

CATALOG_PATH = Path(__file__).parents[1] / "src" / "finance_engine" / "startup_cost_catalog.yaml"


def test_startup_cost_totals_include_each_restaurant_category() -> None:
    result = estimate_startup_cost(
        [
            StartupCostItem("rent_deposit", "Two-month deposit", Decimal(2), Decimal(1000)),
            StartupCostItem("renovation", "Dining area", Decimal("10.5"), Decimal("20.25")),
            StartupCostItem("kitchen_equipment", "Oven", Decimal(1), Decimal("1250.50")),
            StartupCostItem("furniture", "Tables", Decimal(4), Decimal(100)),
            StartupCostItem("licenses", "Permit", Decimal(1), Decimal(75)),
            StartupCostItem("initial_stock", "Opening stock", Decimal(1), Decimal(500)),
            StartupCostItem("marketing", "Launch campaign", Decimal(1), Decimal(200)),
            StartupCostItem("reserve", "One-month reserve", Decimal(1), Decimal(1000)),
        ]
    )

    assert len(result.items) == len(STARTUP_COST_CATEGORIES)
    assert result.category_totals == {
        "rent_deposit": Decimal("2000.00"),
        "renovation": Decimal("212.63"),
        "kitchen_equipment": Decimal("1250.50"),
        "furniture": Decimal("400.00"),
        "licenses": Decimal("75.00"),
        "initial_stock": Decimal("500.00"),
        "marketing": Decimal("200.00"),
        "reserve": Decimal("1000.00"),
    }
    assert result.total_cost == Decimal("5638.13")


def test_startup_cost_supports_empty_and_fractional_item_lists() -> None:
    empty = estimate_startup_cost([])
    assert empty.total_cost == Decimal(0)
    assert set(empty.category_totals) == set(STARTUP_COST_CATEGORIES)

    fractional = estimate_startup_cost(
        [StartupCostItem("furniture", "Chair", Decimal(3), Decimal("10.005"))]
    )
    assert fractional.items[0].total_cost == Decimal("30.02")
    assert fractional.total_cost == Decimal("30.02")


@pytest.mark.parametrize(
    "item",
    [
        StartupCostItem("reserve", "Reserve", Decimal(-1), Decimal(100)),
        StartupCostItem("reserve", "Reserve", Decimal(1), Decimal(-100)),
        StartupCostItem("reserve", " ", Decimal(1), Decimal(100)),
    ],
)
def test_startup_cost_rejects_invalid_items(item: StartupCostItem) -> None:
    with pytest.raises(ValueError):
        estimate_startup_cost([item])


def test_startup_cost_catalog_has_versioned_unverified_price_placeholders() -> None:
    with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
        catalog = yaml.safe_load(catalog_file)

    assert catalog["version"] == 1
    assert catalog["currency"] == "UZS"
    assert {entry["key"] for entry in catalog["categories"]} == set(
        STARTUP_COST_CATEGORIES
    )
    assert all(entry["unit_price"] is None for entry in catalog["categories"])
    assert all(entry["verified"] is False for entry in catalog["categories"])
    assert all(
        entry["source_url"] == "TODO(VERIFY)"
        and entry["effective_date"] == "TODO(VERIFY)"
        for entry in catalog["categories"]
    )
