import json
from collections.abc import AsyncIterator
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import Field
from sqlalchemy.orm import Session

from finadvisor_api.ai_client import AIClientError, stream
from finadvisor_api.calc_schemas import StrictInput
from finadvisor_api.database import get_db
from finadvisor_api.knowledge import KnowledgeResult, search_knowledge
from finadvisor_api.plan_schemas import PlanCalculations

router = APIRouter(prefix="/chat", tags=["chat"])

CHAT_PROMPT = """Answer the user's business-planning question in the requested language.
Use retrieved reference excerpts as background and only use the supplied prepared finance-engine results for financial figures.
Never calculate, estimate, invent, or change a monetary value, percentage, tax rate, or financial ratio.
If the prepared results do not contain a requested figure, say that a calculator is needed.
Do not treat retrieved excerpts as a substitute for current professional advice.
"""


class ChatRequest(StrictInput):
    locale: Literal["uz", "ru", "en"]
    message: str = Field(min_length=1, max_length=4_000)
    plan_calculations: PlanCalculations | None = None
    top_k: int = Field(default=5, ge=1, le=10)


def _chat_context(
    payload: ChatRequest, knowledge: list[KnowledgeResult]
) -> dict[str, object]:
    return {
        "locale": payload.locale,
        "question": payload.message,
        "prepared_finance_engine_results": (
            payload.plan_calculations.model_dump()
            if payload.plan_calculations is not None
            else None
        ),
        "retrieved_references": [
            {
                "source": result.source,
                "source_url": result.source_url,
                "excerpt": result.content,
            }
            for result in knowledge
        ],
    }


@router.post("/stream")
def stream_chat(
    payload: ChatRequest, db: Annotated[Session, Depends(get_db)]
) -> StreamingResponse:
    knowledge = search_knowledge(db, payload.message, payload.top_k)
    context = _chat_context(payload, knowledge)

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for part in stream(CHAT_PROMPT, context):
                yield f"data: {json.dumps({'text': part}, ensure_ascii=False)}\n\n"
        except AIClientError:
            yield (
                "event: error\n"
                f"data: {json.dumps({'detail': 'chat.ai_unavailable'})}\n\n"
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
