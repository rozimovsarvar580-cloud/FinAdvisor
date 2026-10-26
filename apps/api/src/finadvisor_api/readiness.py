from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files

import yaml


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


@lru_cache(maxsize=1)
def _load_criteria() -> tuple[ReadinessCriterion, ...]:
    checklist_path = files("finadvisor_api").joinpath("data/bank_checklist.yaml")
    try:
        raw_checklist = yaml.safe_load(checklist_path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise RuntimeError("The bank readiness checklist cannot be loaded") from error

    if not isinstance(raw_checklist, dict) or raw_checklist.get("version") != 1:
        raise RuntimeError("The bank readiness checklist has an invalid version")

    raw_criteria = raw_checklist.get("criteria")
    if not isinstance(raw_criteria, list) or not raw_criteria:
        raise RuntimeError("The bank readiness checklist has no criteria")

    criteria: list[ReadinessCriterion] = []
    for item in raw_criteria:
        if not isinstance(item, dict):
            raise TypeError("The bank readiness checklist contains an invalid criterion")
        key = item.get("key")
        weight = item.get("weight")
        keywords = item.get("keywords")
        if (
            not isinstance(key, str)
            or not key
            or not isinstance(weight, int)
            or weight <= 0
            or not isinstance(keywords, list)
            or not keywords
            or any(not isinstance(keyword, str) or not keyword for keyword in keywords)
        ):
            raise RuntimeError("The bank readiness checklist contains an invalid criterion")
        criteria.append(ReadinessCriterion(key, weight, tuple(keywords)))

    if sum(criterion.weight for criterion in criteria) != 100:
        raise RuntimeError("The bank readiness checklist weights must total 100")
    if len({criterion.key for criterion in criteria}) != len(criteria):
        raise RuntimeError("The bank readiness checklist contains duplicate criteria")
    return tuple(criteria)


def calculate_bank_readiness(text: str) -> ReadinessResult:
    normalized_text = text.casefold()
    criterion_scores: list[CriterionScore] = []
    for criterion in _load_criteria():
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
    criteria = tuple(criterion_scores)
    present_criteria = tuple(item.key for item in criteria if item.present)
    missing_criteria = tuple(item.key for item in criteria if not item.present)
    return ReadinessResult(
        score=sum(item.score for item in criteria),
        criteria=criteria,
        present_criteria=present_criteria,
        missing_criteria=missing_criteria,
        formula="score = sum of earned criterion weights; checklist version 1",
    )
