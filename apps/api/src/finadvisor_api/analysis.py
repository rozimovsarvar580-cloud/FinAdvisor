from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from finadvisor_api.document_analysis import (
    DocumentExtractionError,
    analyze_business_plan,
)

router = APIRouter(prefix="/plans", tags=["plan-analysis"])


class BankReadinessResponse(BaseModel):
    score: int
    present_criteria: list[str]
    missing_criteria: list[str]
    word_count: int
    formula: str


@router.post("/analyze", response_model=BankReadinessResponse)
async def analyze_plan(
    file: Annotated[UploadFile, File()]
) -> BankReadinessResponse:
    content = await file.read(15 * 1024 * 1024 + 1)
    try:
        result, word_count = analyze_business_plan(file.filename or "", content)
    except DocumentExtractionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error

    return BankReadinessResponse(
        score=result.score,
        present_criteria=list(result.present_criteria),
        missing_criteria=list(result.missing_criteria),
        word_count=word_count,
        formula=result.formula,
    )
