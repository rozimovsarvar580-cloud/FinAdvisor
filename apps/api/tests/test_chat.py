import json

from fastapi.testclient import TestClient

from finadvisor_api import chat
from finadvisor_api.ai_client import AIClientError
from finadvisor_api.knowledge import KnowledgeResult
from finadvisor_api.main import app

client = TestClient(app)


def test_chat_stream_includes_retrieved_sources_and_prepared_plan(
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_search(db, query: str, top_k: int):
        assert query == "How should I prepare?"
        assert top_k == 5
        return [
            KnowledgeResult(
                "sample", "https://example.test/rule", "Reference excerpt.", 0.8
            )
        ]

    async def fake_stream(prompt: str, context: dict[str, object]):
        captured["prompt"] = prompt
        captured["context"] = context
        yield "Answer "
        yield "stream"

    monkeypatch.setattr(chat, "search_knowledge", fake_search)
    monkeypatch.setattr(chat, "stream", fake_stream)

    response = client.post(
        "/chat/stream",
        json={
            "locale": "en",
            "message": "How should I prepare?",
            "plan_calculations": {
                "monthly_revenue": "1000",
                "monthly_payroll": "100",
                "startup_capex": "500",
                "total_startup_cost": "500",
                "monthly_fixed_costs": "200",
                "monthly_variable_cost": "300",
                "monthly_operating_profit": "500",
                "annual_operating_profit": "6000",
                "break_even_revenue": "400",
                "target_monthly_revenue": "700",
                "loan_first_payment": None,
                "loan_total_payment": None,
                "loan_total_interest": None,
                "loan_term_months": None,
                "annual_debt_service": None,
                "dscr": None,
            },
        },
    )

    events = [line for line in response.text.splitlines() if line.startswith("data:")]
    assert response.status_code == 200
    assert json.loads(events[0][6:])["text"] == "Answer "
    assert "Never calculate" in captured["prompt"]
    assert captured["context"]["prepared_finance_engine_results"]["monthly_revenue"] == "1000"
    assert captured["context"]["retrieved_references"][0]["source"] == "sample"


def test_chat_stream_surfaces_ai_errors_as_sse_event(monkeypatch) -> None:
    monkeypatch.setattr(
        chat,
        "search_knowledge",
        lambda db, query, top_k: [],
    )

    async def unavailable(prompt: str, context: dict[str, object]):
        raise AIClientError("provider unavailable")
        yield ""

    monkeypatch.setattr(chat, "stream", unavailable)

    response = client.post(
        "/chat/stream",
        json={"locale": "uz", "message": "Qanday reja kerak?"},
    )

    assert response.status_code == 200
    assert "event: error" in response.text
    assert "chat.ai_unavailable" in response.text
