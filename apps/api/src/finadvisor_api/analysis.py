from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from finadvisor_api.ai_client import AIClientError, generate, get_ai_provider_status
from finadvisor_api.ai_metering import capture_user_ai_usage, reserve_ai_request
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.document_analysis import (
    MAX_DOCUMENT_BYTES,
    DocumentExtractionError,
    extract_document_text,
)
from finadvisor_api.models import User
from finadvisor_api.plan_limits import reserve_plan_analysis_upload
from finadvisor_api.readiness import ReadinessResult, calculate_bank_readiness

router = APIRouter(prefix="/plans", tags=["plan-analysis"])
MAX_ANALYSIS_TEXT_CHARS = 50_000

ANALYSIS_PROMPT = """Review the supplied business-plan text using the supplied checklist.
For each missing criterion, return one concrete fix and a concise draft section.
Do not calculate or invent figures, facts, market statistics, bank terms, or legal claims.
Do not include digits or numeric values in fixes or draft sections. Use clear placeholders
for information not supplied by the document. Answer in the requested language.
Return valid JSON only, shaped as {"improvements":[{"key":"string","fix":"string",
"rewritten_section":"string"}]}.
"""


class CriterionScoreResponse(BaseModel):
    key: str
    score: int
    max_score: int
    present: bool


class AnalysisImprovement(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    key: str = Field(min_length=1, max_length=100)
    fix: str = Field(min_length=1, max_length=2_000)
    rewritten_section: str = Field(min_length=1, max_length=5_000)


class AnalysisDrafts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    improvements: list[AnalysisImprovement]


class BankReadinessResponse(BaseModel):
    score: int
    criteria: list[CriterionScoreResponse]
    present_criteria: list[str]
    missing_criteria: list[str]
    improvements: list[AnalysisImprovement]
    word_count: int
    formula: str


def _improvements(
    raw_response: str,
    result: ReadinessResult,
) -> list[AnalysisImprovement]:
    try:
        drafts = AnalysisDrafts.model_validate_json(raw_response)
    except (ValidationError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="analysis.invalid_ai_response",
        ) from error

    expected_keys = set(result.missing_criteria)
    received_keys = [item.key for item in drafts.improvements]
    if (
        len(received_keys) != len(set(received_keys))
        or set(received_keys) != expected_keys
        or any(
            character.isdigit()
            for item in drafts.improvements
            for character in item.fix + item.rewritten_section
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="analysis.invalid_ai_response",
        )
    return drafts.improvements


@router.post("/analyze", response_model=BankReadinessResponse)
async def analyze_plan(
    file: Annotated[UploadFile, File()],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    locale: Annotated[Literal["uz", "ru", "en"], Form()] = "en",
) -> BankReadinessResponse:
    reserve_plan_analysis_upload(db, user)
    content = await file.read(MAX_DOCUMENT_BYTES + 1)
    try:
        text = extract_document_text(file.filename or "", content)
    except DocumentExtractionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error

    if len(text) > MAX_ANALYSIS_TEXT_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="analysis.text_too_long",
        )

    result = calculate_bank_readiness(text)
    improvements: list[AnalysisImprovement] = []
    if result.missing_criteria:
        context: dict[str, object] = {
            "locale": locale,
            "document_text": text,
            "criteria": [
                {
                    "key": criterion.key,
                    "score": criterion.score,
                    "max_score": criterion.max_score,
                    "present": criterion.present,
                }
                for criterion in result.criteria
            ],
            "missing_criteria": list(result.missing_criteria),
        }
        usage_date = reserve_ai_request(db, user)
        try:
            with capture_user_ai_usage(
                db,
                user,
                usage_date,
                get_ai_provider_status().model,
            ):
                raw_response = await generate(ANALYSIS_PROMPT, context)
        except AIClientError as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="analysis.ai_unavailable",
            ) from error
        improvements = _improvements(raw_response, result)

    return BankReadinessResponse(
        score=result.score,
        criteria=[
            CriterionScoreResponse(
                key=criterion.key,
                score=criterion.score,
                max_score=criterion.max_score,
                present=criterion.present,
            )
            for criterion in result.criteria
        ],
        present_criteria=list(result.present_criteria),
        missing_criteria=list(result.missing_criteria),
        improvements=improvements,
        word_count=len(text.split()),
        formula=result.formula,
    )
