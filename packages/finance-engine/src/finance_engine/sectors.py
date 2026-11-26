"""Load and validate versioned, structure-only business sector definitions."""

from collections.abc import Mapping
from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path

import yaml

REQUIRED_LOCALES = frozenset({"en", "ru", "uz"})
REQUIRED_SECTOR_IDS = (
    "restaurant_cafe",
    "retail_shop",
    "online_store",
    "beauty_salon",
    "auto_service",
    "fitness_studio",
    "education_center",
    "food_production",
    "delivery_logistics",
    "it_services",
    "accommodation",
    "construction_repair",
    "generic_other",
)
REVENUE_MODEL_TYPES = frozenset(
    {
        "capacity_utilization",
        "unit_sales",
        "hourly_service",
        "recurring",
        "project_based",
    }
)


@dataclass(frozen=True)
class SectorDefinition:
    id: str
    names: Mapping[str, str]
    revenue_model_type: str
    cost_categories: tuple[str, ...]
    staff_roles: tuple[str, ...]
    inventory_cogs_behavior: Mapping[str, object]
    kpis: tuple[str, ...]
    questions: Mapping[str, tuple[str, ...]]
    licenses_regulations: tuple[Mapping[str, object], ...]


def _localized_names(value: object, field: str) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != REQUIRED_LOCALES:
        raise ValueError(f"{field} must define exactly en, ru, and uz")
    parsed: dict[str, str] = {}
    for locale, content in value.items():
        if not isinstance(content, str) or not content.strip():
            raise ValueError(f"{field}.{locale} must be a non-empty string")
        parsed[locale] = content
    return parsed


def _localized_questions(value: object, field: str) -> dict[str, tuple[str, ...]]:
    if not isinstance(value, dict) or set(value) != REQUIRED_LOCALES:
        raise ValueError(f"{field} must define exactly en, ru, and uz")
    parsed: dict[str, tuple[str, ...]] = {}
    for locale, content in value.items():
        if not isinstance(content, list) or not content:
            raise ValueError(f"{field}.{locale} must be a non-empty list")
        if not all(isinstance(item, str) and item.strip() for item in content):
            raise ValueError(f"{field}.{locale} entries must be non-empty strings")
        parsed[locale] = tuple(content)
    return parsed


def _string_list(value: object, field: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{field} must be a non-empty list")
    if not all(isinstance(item, str) and item.strip() for item in value):
        raise ValueError(f"{field} entries must be non-empty strings")
    if len(set(value)) != len(value):
        raise ValueError(f"{field} entries must be unique")
    return tuple(value)


def _parse_sector(value: object) -> SectorDefinition:
    if not isinstance(value, dict):
        raise TypeError("each sector definition must be a mapping")

    sector_id = value.get("id")
    if not isinstance(sector_id, str) or not sector_id.strip():
        raise ValueError("sector id must be a non-empty string")
    names = _localized_names(value.get("names"), f"{sector_id}.names")

    revenue_model_type = value.get("revenue_model_type")
    if revenue_model_type not in REVENUE_MODEL_TYPES:
        raise ValueError(f"{sector_id}.revenue_model_type is unsupported")

    behavior = value.get("inventory_cogs_behavior")
    if not isinstance(behavior, dict):
        raise TypeError(f"{sector_id}.inventory_cogs_behavior must be a mapping")
    if behavior.get("inventory_tracking") not in {
        "user_input",
        "optional",
        "not_applicable",
    }:
        raise ValueError(f"{sector_id}.inventory_tracking is unsupported")
    if behavior.get("cogs_basis") not in {
        "unit_cost",
        "percent_of_revenue_or_unit_cost",
        "project_cost",
        "service_inputs",
        "user_defined",
        "percent_of_revenue",
    }:
        raise ValueError(f"{sector_id}.cogs_basis is unsupported")
    if behavior.get("user_supplied_only") is not True:
        raise ValueError(f"{sector_id}.behavior must use user-supplied values only")
    if "default_value" in behavior or "benchmark" in behavior:
        raise ValueError(f"{sector_id}.behavior must not define benchmarks or defaults")

    questions = _localized_questions(
        value.get("questions"), f"{sector_id}.questions"
    )
    licenses = value.get("licenses_regulations")
    if not isinstance(licenses, list):
        raise TypeError(f"{sector_id}.licenses_regulations must be a list")
    parsed_licenses: list[Mapping[str, object]] = []
    for entry in licenses:
        if not isinstance(entry, dict):
            raise TypeError(
                f"{sector_id} license/regulation entries must be mappings"
            )
        if (
            entry.get("source_url") != "TODO(VERIFY)"
            or entry.get("effective_date") != "TODO(VERIFY)"
            or entry.get("verified") is not False
        ):
            raise ValueError(
                f"{sector_id} license/regulation entries require TODO(VERIFY) "
                "provenance and verified: false"
            )
        _localized_names(entry.get("names"), f"{sector_id}.license.names")
        parsed_licenses.append(entry)

    return SectorDefinition(
        id=sector_id,
        names=names,
        revenue_model_type=revenue_model_type,
        cost_categories=_string_list(
            value.get("cost_categories"), f"{sector_id}.cost_categories"
        ),
        staff_roles=_string_list(value.get("staff_roles"), f"{sector_id}.staff_roles"),
        inventory_cogs_behavior=behavior,
        kpis=_string_list(value.get("kpis"), f"{sector_id}.kpis"),
        questions=questions,
        licenses_regulations=tuple(parsed_licenses),
    )


def load_sectors(path: Path | None = None) -> tuple[SectorDefinition, ...]:
    """Load sector definitions, optionally from a file for validation and tests."""
    if path is None:
        with files("finance_engine").joinpath("sectors.yaml").open(
            encoding="utf-8"
        ) as source:
            registry = yaml.safe_load(source)
    else:
        with path.open(encoding="utf-8") as source:
            registry = yaml.safe_load(source)

    if not isinstance(registry, dict) or registry.get("schema_version") != 1:
        raise ValueError("sector registry schema_version must be 1")
    definitions = registry.get("sectors")
    if not isinstance(definitions, list) or not definitions:
        raise ValueError("sector registry must contain a non-empty sectors list")

    raw_ids = [
        definition.get("id")
        for definition in definitions
        if isinstance(definition, dict)
    ]
    valid_ids = [sector_id for sector_id in raw_ids if isinstance(sector_id, str)]
    if len(valid_ids) != len(set(valid_ids)):
        raise ValueError("sector registry contains a duplicate sector id")

    sectors = tuple(_parse_sector(definition) for definition in definitions)
    return sectors
