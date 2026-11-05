from decimal import Decimal

import pytest

from finance_engine.ai_cost import estimate_ai_cost


def test_gpt_4o_mini_cost_uses_exact_decimal_token_rates() -> None:
    estimate = estimate_ai_cost("gpt-4o-mini", 1_000, 500)

    assert estimate is not None
    assert estimate.amount_usd == Decimal("0.00045")
    assert estimate.verified is False


def test_unknown_model_cost_is_not_invented() -> None:
    assert estimate_ai_cost("unpriced-model", 100, 100) is None


@pytest.mark.parametrize(
    ("input_tokens", "output_tokens"),
    [(-1, 0), (0, -1), (1.5, 0)],
)
def test_ai_cost_rejects_invalid_token_counts(
    input_tokens: float,
    output_tokens: int,
) -> None:
    with pytest.raises(ValueError, match="non-negative integers"):
        estimate_ai_cost("gpt-4o-mini", input_tokens, output_tokens)
