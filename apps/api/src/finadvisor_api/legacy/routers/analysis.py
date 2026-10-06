from fastapi import APIRouter

from ..schemas import ExplanationRequest

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/{plan_id}")
async def analyze_plan(plan_id: str) -> dict[str, object]:
    return {
        "plan_id": plan_id,
        "bank_readiness": {"score": 72, "currency": "UZS", "status": "needs_review"},
        "strengths": ["Positive operating profit", "Scenario data is present"],
        "risks": ["Cash reserve should cover at least three months"],
        "explanation": "This is an explanation of finance-engine results; no calculations are performed by the language model.",
    }


@router.post("/{plan_id}/explain")
async def explain_plan_result(plan_id: str, data: ExplanationRequest) -> dict[str, object]:
    """Explain supplied engine output without recomputing financial values."""
    return {
        "plan_id": plan_id,
        "answer": (
            "The finance engine result is shown as provided. "
            "Compare revenue, costs, profit, and currency before making a decision."
        ),
        "question": data.question,
        "referenced_result": data.result,
        "disclaimer": "This explanation is informational and is not financial advice.",
    }
