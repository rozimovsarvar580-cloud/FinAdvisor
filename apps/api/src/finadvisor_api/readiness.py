from dataclasses import dataclass


@dataclass(frozen=True)
class ReadinessCriterion:
    key: str
    weight: int
    keywords: tuple[str, ...]


READINESS_CRITERIA = (
    ReadinessCriterion(
        "project_overview",
        20,
        ("restaurant", "business", "cafe", "loyiha", "restoran", "проект"),
    ),
    ReadinessCriterion(
        "market",
        20,
        ("market", "customer", "mijoz", "bozor", "рынок", "клиент"),
    ),
    ReadinessCriterion(
        "team",
        20,
        ("team", "staff", "employee", "jamoa", "xodim", "команда"),
    ),
    ReadinessCriterion(
        "financials",
        20,
        ("revenue", "profit", "financial", "tushum", "foyda", "м финансов"),
    ),
    ReadinessCriterion(
        "funding",
        20,
        ("loan", "credit", "funding", "kredit", "qarz", "кредит"),
    ),
)


@dataclass(frozen=True)
class ReadinessResult:
    score: int
    present_criteria: tuple[str, ...]
    missing_criteria: tuple[str, ...]
    formula: str


def calculate_bank_readiness(text: str) -> ReadinessResult:
    normalized_text = text.casefold()
    present: list[str] = []
    missing: list[str] = []
    score = 0

    for criterion in READINESS_CRITERIA:
        if any(keyword in normalized_text for keyword in criterion.keywords):
            score += criterion.weight
            present.append(criterion.key)
        else:
            missing.append(criterion.key)

    return ReadinessResult(
        score=min(score, 100),
        present_criteria=tuple(present),
        missing_criteria=tuple(missing),
        formula="score = sum(weights for present required document sections)",
    )
