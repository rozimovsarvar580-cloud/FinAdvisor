from finadvisor_api.readiness import calculate_bank_readiness


def test_bank_readiness_scores_all_seven_criteria() -> None:
    result = calculate_bank_readiness(
        "Restaurant business overview, market and customers, staff team, "
        "financial revenue and profit, loan funding, risk mitigation, collateral, "
        "legal license."
    )

    assert result.score == 100
    assert result.missing_criteria == ()
    assert len(result.criteria) == 7
    assert all(criterion.score == criterion.max_score for criterion in result.criteria)
    assert result.formula


def test_bank_readiness_identifies_missing_sections_and_zero_score() -> None:
    empty = calculate_bank_readiness("")
    partial = calculate_bank_readiness("restaurant staff")

    assert empty.score == 0
    assert len(empty.missing_criteria) == 7
    assert partial.score == 10
    assert partial.missing_criteria == (
        "market_analysis",
        "financial_projections",
        "repayment_ability",
        "risks",
        "collateral",
        "legal",
    )
