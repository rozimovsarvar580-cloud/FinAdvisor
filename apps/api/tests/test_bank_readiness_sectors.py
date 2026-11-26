import pytest

from finadvisor_api.readiness import calculate_bank_readiness

SECTOR_SAMPLES = [
    (
        "restaurant_cafe",
        (
            "Market customers, financial revenue, loan repayment, risk mitigation, "
            "collateral assets, team staff, legal permits, seat utilization, and food cost."
        ),
        95,
        100,
    ),
    (
        "retail_shop",
        (
            "Market customers, financial revenue, loan repayment, risk mitigation, "
            "team staff, legal permits, and inventory turnover."
        ),
        80,
        85,
    ),
    (
        "it_services",
        "Market customers, financial projections revenue, project pipeline, billable utilization.",
        50,
        55,
    ),
]


@pytest.mark.parametrize(
    ("sector_id", "sample_plan", "minimum_score", "maximum_score"),
    SECTOR_SAMPLES,
)
def test_sector_sample_plans_score_with_base_and_sector_criteria(
    sector_id: str,
    sample_plan: str,
    minimum_score: int,
    maximum_score: int,
) -> None:
    result = calculate_bank_readiness(sample_plan, sector_id=sector_id)

    assert minimum_score <= result.score <= maximum_score
    assert sum(criterion.max_score for criterion in result.criteria) == 100
    assert result.score == sum(criterion.score for criterion in result.criteria)
    assert any(
        criterion.key not in {
            "market_analysis",
            "financial_projections",
            "repayment_ability",
            "risks",
            "collateral",
            "team",
            "legal",
        }
        for criterion in result.criteria
    )
    assert sector_id in result.formula


def test_generic_checklist_remains_unchanged_without_sector_selection() -> None:
    result = calculate_bank_readiness("Market customers financial revenue")

    assert result.score == 40
    assert len(result.criteria) == 7
    assert sum(criterion.max_score for criterion in result.criteria) == 100


def test_readiness_rejects_unknown_sector() -> None:
    with pytest.raises(ValueError, match="Unknown sector_id"):
        calculate_bank_readiness("A business plan", sector_id="not-a-sector")
