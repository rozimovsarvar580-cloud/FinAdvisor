from finadvisor_api.readiness import calculate_bank_readiness


def test_bank_readiness_scores_all_five_sections() -> None:
    result = calculate_bank_readiness(
        "Restaurant business overview, market and customers, staff team, "
        "financial revenue and profit, loan funding."
    )

    assert result.score == 100
    assert result.missing_criteria == ()
    assert result.formula


def test_bank_readiness_identifies_missing_sections_and_zero_score() -> None:
    empty = calculate_bank_readiness("")
    partial = calculate_bank_readiness("restaurant staff")

    assert empty.score == 0
    assert len(empty.missing_criteria) == 5
    assert partial.score == 40
    assert partial.missing_criteria == ("market", "financials", "funding")
