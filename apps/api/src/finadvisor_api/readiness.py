from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files

import yaml
from finance_engine.sectors import REQUIRED_SECTOR_IDS


@dataclass(frozen=True)
class ReadinessCriterion:
    key: str
    weight: int
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class CriterionScore:
    key: str
    score: int
    max_score: int
    present: bool


@dataclass(frozen=True)
class ReadinessResult:
    score: int
    criteria: tuple[CriterionScore, ...]
    present_criteria: tuple[str, ...]
    missing_criteria: tuple[str, ...]
    formula: str


def _parse_criteria(value: object, field: str) -> tuple[ReadinessCriterion, ...]:
    if not isinstance(value, list) or not value:
        raise RuntimeError(f"The bank readiness checklist has no {field}")
    criteria: list[ReadinessCriterion] = []
    for item in value:
        if not isinstance(item, dict):
            raise TypeError(f"The bank readiness checklist contains an invalid {field} criterion")
        key = item.get("key")
        weight = item.get("weight")
        keywords = item.get("keywords")
        if (
            not isinstance(key, str)
            or not key
            or type(weight) is not int
            or weight <= 0
            or not isinstance(keywords, list)
            or not keywords
            or any(not isinstance(keyword, str) or not keyword for keyword in keywords)
            or len(set(keywords)) != len(keywords)
        ):
            raise RuntimeError(
                f"The bank readiness checklist contains an invalid {field} criterion"
            )
        criteria.append(ReadinessCriterion(key, weight, tuple(keywords)))
    if len({criterion.key for criterion in criteria}) != len(criteria):
        raise RuntimeError(f"The bank readiness checklist contains duplicate {field} keys")
    return tuple(criteria)


@lru_cache(maxsize=1)
def _load_checklist() -> tuple[
    tuple[ReadinessCriterion, ...],
    int,
    dict[str, tuple[ReadinessCriterion, ...]],
]:
    checklist_path = files("finadvisor_api").joinpath("data/bank_checklist.yaml")
    try:
        raw_checklist = yaml.safe_load(checklist_path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise RuntimeError("The bank readiness checklist cannot be loaded") from error

    if not isinstance(raw_checklist, dict) or raw_checklist.get("version") != 1:
        raise RuntimeError("The bank readiness checklist has an invalid version")

    base_criteria = _parse_criteria(raw_checklist.get("criteria"), "base")
    base_weight_total = sum(criterion.weight for criterion in base_criteria)
    if base_weight_total != 100:
        raise RuntimeError("The bank readiness base weights must total 100")

    addon_weight = raw_checklist.get("sector_addon_weight")
    if type(addon_weight) is not int or not 1 <= addon_weight < 100:
        raise RuntimeError("The bank readiness sector_addon_weight must be from 1 to 99")

    raw_addons = raw_checklist.get("sector_addons")
    if not isinstance(raw_addons, dict) or set(raw_addons) != set(REQUIRED_SECTOR_IDS):
        raise RuntimeError("The bank readiness sector_addons must cover every registered sector")

    addons: dict[str, tuple[ReadinessCriterion, ...]] = {}
    base_keys = {criterion.key for criterion in base_criteria}
    for sector_id in REQUIRED_SECTOR_IDS:
        sector_criteria = _parse_criteria(raw_addons[sector_id], f"{sector_id} sector")
        if sum(criterion.weight for criterion in sector_criteria) != addon_weight:
            raise RuntimeError(
                f"The bank readiness weights for {sector_id} must total {addon_weight}"
            )
        if base_keys.intersection(criterion.key for criterion in sector_criteria):
            raise RuntimeError(f"The {sector_id} sector checklist duplicates a base key")
        if any(
            criterion.weight * (100 - addon_weight) % base_weight_total
            for criterion in base_criteria
        ):
            raise RuntimeError("The bank readiness base weights cannot be scaled evenly")
        addons[sector_id] = sector_criteria

    return base_criteria, addon_weight, addons


@lru_cache(maxsize=1)
def _load_criteria() -> tuple[ReadinessCriterion, ...]:
    return _load_checklist()[0]


def calculate_bank_readiness(
    text: str,
    sector_id: str | None = None,
) -> ReadinessResult:
    base_criteria, addon_weight, sector_addons = _load_checklist()
    if sector_id is None:
        criteria = base_criteria
        formula = "score = sum of earned criterion weights; generic checklist version 1"
    else:
        if sector_id not in sector_addons:
            raise ValueError(f"Unknown sector_id: {sector_id}")
        base_contribution = 100 - addon_weight
        scaled_base = tuple(
            ReadinessCriterion(
                criterion.key,
                criterion.weight * base_contribution // 100,
                criterion.keywords,
            )
            for criterion in base_criteria
        )
        criteria = (*scaled_base, *sector_addons[sector_id])
        formula = (
            f"score = sum of earned weights; generic base contributes "
            f"{base_contribution} points and {sector_id} add-ons contribute "
            f"{addon_weight} points; checklist version 1"
        )

    normalized_text = text.casefold()
    criterion_scores: list[CriterionScore] = []
    for criterion in criteria:
        present = any(
            keyword.casefold() in normalized_text
            for keyword in criterion.keywords
        )
        criterion_scores.append(
            CriterionScore(
                key=criterion.key,
                score=criterion.weight if present else 0,
                max_score=criterion.weight,
                present=present,
            )
        )
    scored_criteria = tuple(criterion_scores)
    present_criteria = tuple(item.key for item in scored_criteria if item.present)
    missing_criteria = tuple(item.key for item in scored_criteria if not item.present)
    return ReadinessResult(
        score=sum(item.score for item in scored_criteria),
        criteria=scored_criteria,
        present_criteria=present_criteria,
        missing_criteria=missing_criteria,
        formula=formula,
    )
