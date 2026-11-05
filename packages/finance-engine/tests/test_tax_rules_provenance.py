from pathlib import Path

import pytest
import yaml

from finance_engine.tax import tax_rule_provenance

RULES_PATH = Path(__file__).parents[1] / "src" / "finance_engine" / "tax_rules_2026.yaml"


def test_every_tax_and_payroll_rule_has_provenance_and_verification_state() -> None:
    source_name, rules = tax_rule_provenance()

    assert source_name == "Uzbekistan Tax Code, LexUZ"
    assert {rule.key for rule in rules} == {
        "turnover_tax",
        "profit_tax",
        "employer_social_contribution",
    }
    assert all(rule.source_url for rule in rules)
    assert all(rule.effective_date for rule in rules)
    assert all(rule.verified is False for rule in rules)
    assert all(rule.verified_by is None for rule in rules)


def test_missing_tax_provenance_metadata_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "tax_rules.yaml"
    path.write_text(
        yaml.safe_dump(
            {
                "source": {"name": "test source", "url": "https://example.test"},
                "regimes": {
                    "invalid": {
                        "rate": "0.1",
                        "base": "annual_revenue",
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(TypeError, match="provenance"):
        tax_rule_provenance(path)


def test_verified_tax_rule_requires_a_verifier_name(tmp_path: Path) -> None:
    path = tmp_path / "tax_rules.yaml"
    path.write_text(
        yaml.safe_dump(
            {
                "source": {"name": "test source", "url": "https://example.test"},
                "regimes": {
                    "invalid": {
                        "rate": "0.1",
                        "base": "annual_revenue",
                        "source_url": "https://example.test/rule",
                        "effective_date": "2026-01-01",
                        "verified": True,
                        "verified_by": None,
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="verified_by"):
        tax_rule_provenance(path)
