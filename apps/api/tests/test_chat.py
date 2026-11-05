import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import chat
from finadvisor_api.ai_client import AIClientError
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.knowledge import KnowledgeResult
from finadvisor_api.main import app
from finadvisor_api.models import ChatConversation, ChatMessage, User

client = TestClient(app)


@pytest.fixture
def chat_database(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    def override_get_db():
        with testing_session_local() as session:
            yield session

    user = User(
        id="test-chat-user",
        email="chat-user@example.com",
        name="Chat User",
        role="tadbirkor",
    )
    with testing_session_local() as session:
        session.add(user)
        session.commit()

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)
    yield testing_session_local, user
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.mark.parametrize(
    ("message", "expected_intent"),
    [
        ("How do I handle taxes?", "tax"),
        ("Should I take a loan?", "credit"),
        ("How many staff should I hire?", "staffing"),
        ("What marketing should I use?", "marketing"),
        ("Which bank should I choose?", "bank_choice"),
        ("How should I organize the business?", "general"),
    ],
)
def test_chat_intent_detection(message: str, expected_intent: str) -> None:
    assert chat.detect_chat_intent(message) == expected_intent


def test_chat_stream_includes_retrieved_sources_and_prepared_plan(
    monkeypatch: pytest.MonkeyPatch,
    chat_database,
) -> None:
    captured: dict[str, object] = {}

    def fake_search(db, query: str, top_k: int):
        assert query == "How should I handle taxes?"
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
            "message": "How should I handle taxes?",
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
    metadata_frame = next(
        frame
        for frame in response.text.split("\n\n")
        if frame.startswith("event: metadata")
    )
    metadata = json.loads(metadata_frame.split("data:", 1)[1])
    assert response.status_code == 200
    assert json.loads(events[1][6:])["text"] == "Answer "
    assert metadata["intent"] == "tax"
    assert metadata["conversation_id"] == response.headers["x-conversation-id"]
    assert metadata["sources"] == [
        {"source": "sample", "source_url": "https://example.test/rule"}
    ]
    assert "Never calculate" in captured["prompt"]
    assert (
        captured["context"]["prepared_finance_engine_results"]["monthly_revenue"]
        == "1000"
    )
    assert captured["context"]["intent"] == "tax"
    assert captured["context"]["retrieved_references"][0]["source"] == "sample"
    assert captured["context"]["conversation_history"] == []

    with chat_database[0]() as db:
        messages = db.scalars(
            select(ChatMessage).order_by(ChatMessage.id)
        ).all()
        conversation = db.get(ChatConversation, metadata["conversation_id"])
    assert [message.role for message in messages] == ["user", "assistant"]
    assert messages[0].content == "How should I handle taxes?"
    assert messages[1].content == "Answer stream"
    assert conversation.owner_id == chat_database[1].id


def test_chat_reuses_owner_history_and_exposes_saved_conversation(
    monkeypatch: pytest.MonkeyPatch,
    chat_database,
) -> None:
    contexts: list[dict[str, object]] = []

    monkeypatch.setattr(
        chat,
        "search_knowledge",
        lambda db, query, top_k: [],
    )

    async def fake_stream(prompt: str, context: dict[str, object]):
        contexts.append(context)
        yield "Grounded answer."

    monkeypatch.setattr(chat, "stream", fake_stream)
    first = client.post(
        "/chat/stream",
        json={"locale": "en", "message": "What is my project?"},
    )
    conversation_id = first.headers["x-conversation-id"]
    second = client.post(
        "/chat/stream",
        json={
            "locale": "en",
            "message": "What marketing should I use?",
            "conversation_id": conversation_id,
        },
    )
    assert second.status_code == 200, second.text
    assert contexts[1]["intent"] == "marketing"
    assert contexts[1]["conversation_history"] == [
        {"role": "user", "content": "What is my project?"},
        {"role": "assistant", "content": "Grounded answer."},
    ]

    history = client.get(f"/chat/conversations/{conversation_id}")
    listings = client.get("/chat/conversations")

    assert history.status_code == 200
    assert [message["role"] for message in history.json()["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert history.json()["id"] == conversation_id
    assert listings.status_code == 200
    assert [item["id"] for item in listings.json()] == [conversation_id]


def test_chat_stream_surfaces_ai_errors_as_sse_event(
    monkeypatch: pytest.MonkeyPatch,
    chat_database,
) -> None:
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


def test_chat_conversation_history_is_owner_scoped(
    monkeypatch: pytest.MonkeyPatch,
    chat_database,
) -> None:
    monkeypatch.setattr(chat, "search_knowledge", lambda db, query, top_k: [])

    async def fake_stream(prompt: str, context: dict[str, object]):
        yield "Answer."

    monkeypatch.setattr(chat, "stream", fake_stream)
    response = client.post(
        "/chat/stream",
        json={"locale": "en", "message": "Hello"},
    )
    conversation_id = response.headers["x-conversation-id"]

    other_user = User(
        id="other-chat-user",
        email="other-chat-user@example.com",
        name="Other User",
        role="tadbirkor",
    )
    with chat_database[0]() as db:
        db.add(other_user)
        db.commit()
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: other_user)

    assert client.get(f"/chat/conversations/{conversation_id}").status_code == 404
    continuation = client.post(
        "/chat/stream",
        json={
            "locale": "en",
            "message": "Can you continue?",
            "conversation_id": conversation_id,
        },
    )
    assert continuation.status_code == 404, continuation.text
