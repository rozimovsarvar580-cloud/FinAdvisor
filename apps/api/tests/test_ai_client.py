import asyncio
import json

import httpx
import pytest

from finadvisor_api.ai_client import AIClientError, OpenAIClient, generate


@pytest.mark.anyio
async def test_generate_sends_context_and_returns_provider_content() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert "prepared numbers" in body["messages"][0]["content"]
        assert json.loads(body["messages"][1]["content"]) == {
            "revenue": "123.45"
        }
        assert request.headers["authorization"] == "Bearer test-key"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"summary":"ready"}'}}]},
        )

    client = OpenAIClient(
        "test-key",
        transport=httpx.MockTransport(handler),
        sleep=lambda _: asyncio.sleep(0),
    )

    response = await client.generate(
        "Use only the prepared numbers.", {"revenue": "123.45"}
    )

    assert response == '{"summary":"ready"}'


@pytest.mark.anyio
async def test_generate_retries_timeout_before_returning_response() -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.ReadTimeout("temporary timeout", request=request)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "response"}}]},
        )

    client = OpenAIClient(
        "test-key",
        max_attempts=2,
        transport=httpx.MockTransport(handler),
        sleep=lambda _: asyncio.sleep(0),
    )

    assert await client.generate("prompt", {}) == "response"
    assert attempts == 2


@pytest.mark.anyio
async def test_generate_fails_explicitly_when_provider_is_unavailable() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "unauthorized"}})

    client = OpenAIClient(
        "test-key",
        transport=httpx.MockTransport(handler),
        sleep=lambda _: asyncio.sleep(0),
    )

    with pytest.raises(AIClientError, match="HTTP 401"):
        await client.generate("prompt", {})


@pytest.mark.anyio
async def test_generate_requires_configured_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(AIClientError, match="OPENAI_API_KEY"):
        await generate("prompt", {})
