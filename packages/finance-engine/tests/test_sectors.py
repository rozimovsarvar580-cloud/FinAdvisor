from pathlib import Path

import pytest
import yaml

from finance_engine.sectors import (
    REQUIRED_LOCALES,
    REQUIRED_SECTOR_IDS,
    load_sectors,
)


def test_versioned_sector_registry_has_complete_structure_and_localized_names() -> None:
    sectors = load_sectors()

    assert {sector.id for sector in sectors} == set(REQUIRED_SECTOR_IDS)
    assert all(sector.names.keys() == REQUIRED_LOCALES for sector in sectors)
    assert all(sector.names[locale] for sector in sectors for locale in REQUIRED_LOCALES)
    assert all(sector.cost_categories for sector in sectors)
    assert all(sector.kpis for sector in sectors)
    assert all(sector.questions.keys() == REQUIRED_LOCALES for sector in sectors)
    assert all(
        sector.inventory_cogs_behavior["user_supplied_only"] is True
        for sector in sectors
    )


def test_sector_registry_contains_structure_but_no_unverified_license_claims() -> None:
    sectors = load_sectors()

    assert all(not sector.licenses_regulations for sector in sectors)
    assert all(
        not sector.inventory_cogs_behavior.get("default_value")
        for sector in sectors
    )


def test_registry_rejects_duplicate_sector_ids(tmp_path: Path) -> None:
    definition = {
        "schema_version": 1,
        "sectors": [
            {
                "id": "generic_other",
                "names": {"en": "Other", "ru": "Другое", "uz": "Boshqa"},
                "revenue_model_type": "project_based",
                "cost_categories": ["operating_costs"],
                "staff_roles": ["owner"],
                "inventory_cogs_behavior": {
                    "inventory_tracking": "user_input",
                    "cogs_basis": "user_defined",
                    "user_supplied_only": True,
                },
                "kpis": ["revenue"],
                "questions": {"en": ["Question"], "ru": ["Вопрос"], "uz": ["Savol"]},
                "licenses_regulations": [],
            }
        ]
        * 2,
    }
    registry_path = tmp_path / "sectors.yaml"
    registry_path.write_text(yaml.safe_dump(definition), encoding="utf-8")

    with pytest.raises(ValueError, match="duplicate sector id"):
        load_sectors(registry_path)


def test_registry_rejects_license_entries_without_verification_placeholders(
    tmp_path: Path,
) -> None:
    definition = {
        "schema_version": 1,
        "sectors": [
            {
                "id": "generic_other",
                "names": {"en": "Other", "ru": "Другое", "uz": "Boshqa"},
                "revenue_model_type": "project_based",
                "cost_categories": ["operating_costs"],
                "staff_roles": ["owner"],
                "inventory_cogs_behavior": {
                    "inventory_tracking": "user_input",
                    "cogs_basis": "user_defined",
                    "user_supplied_only": True,
                },
                "kpis": ["revenue"],
                "questions": {"en": ["Question"], "ru": ["Вопрос"], "uz": ["Savol"]},
                "licenses_regulations": [
                    {
                        "key": "license",
                        "names": {
                            "en": "License",
                            "ru": "Лицензия",
                            "uz": "Litsenziya",
                        },
                        "source_url": "TODO(VERIFY)",
                        "effective_date": "TODO(VERIFY)",
                        "verified": True,
                    }
                ],
            }
        ],
    }
    registry_path = tmp_path / "sectors.yaml"
    registry_path.write_text(yaml.safe_dump(definition), encoding="utf-8")

    with pytest.raises(ValueError, match="verified: false"):
        load_sectors(registry_path)
