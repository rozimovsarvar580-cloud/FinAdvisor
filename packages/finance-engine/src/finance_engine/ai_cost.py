from dataclasses import dataclass
from decimal import Decimal
from importlib.resources import files
from typing import Any

import yaml


@dataclass(frozen=True)
class AICostEstimate:
    amount_usd: Decimal
    verified: bool


def _pricing_catalog() -> dict[str, Any]:
    catalog_path = files("finance_engine").joinpath("ai_model_pricing.yaml")
    with catalog_path.open("r", encoding="utf-8") as catalog_file:
        catalog = yaml.safe_load(catalog_file)
    if not isinstance(catalog, dict) or not isinstance(catalog.get("models"), dict):
        raise TypeError("AI model pricing catalog must define models")
    return catalog["models"]


def estimate_ai_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> AICostEstimate | None:
    if (
        not isinstance(input_tokens, int)
        or not isinstance(output_tokens, int)
        or isinstance(input_tokens, bool)
        or isinstance(output_tokens, bool)
        or input_tokens < 0
        or output_tokens < 0
    ):
        raise ValueError("Token counts must be non-negative integers")

    model_pricing = _pricing_catalog().get(model)
    if model_pricing is None:
        return None
    input_rate = Decimal(str(model_pricing["input_usd_per_million"]))
    output_rate = Decimal(str(model_pricing["output_usd_per_million"]))
    amount = (
        Decimal(input_tokens) * input_rate
        + Decimal(output_tokens) * output_rate
    ) / Decimal(1_000_000)
    return AICostEstimate(
        amount_usd=amount,
        verified=bool(model_pricing["verified"]),
    )
