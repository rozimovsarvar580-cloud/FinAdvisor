import asyncio
import json
import os
from collections.abc import AsyncIterator, Callable
from typing import Any

import httpx


class AIClientError(RuntimeError):
    pass


class OpenAIClient:
    def __init__(
        self,
        api_key: str,
        *,
        model: str = "gpt-4o-mini",
        timeout: float = 30,
        max_attempts: int = 3,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Any] = asyncio.sleep,
    ) -> None:
        if not api_key:
            raise ValueError("An OpenAI API key is required")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self.max_attempts = max_attempts
        self.transport = transport
        self.sleep = sleep

    async def generate(self, prompt: str, context: dict[str, object]) -> str:
        request_body = {
            "model": self.model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": json.dumps(context, ensure_ascii=False),
                },
            ],
        }
        for attempt in range(self.max_attempts):
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout, transport=self.transport
                ) as client:
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        json=request_body,
                    )
                response.raise_for_status()
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                if not isinstance(content, str) or not content:
                    raise AIClientError("The AI provider returned an empty response")
                return content
            except (httpx.TimeoutException, httpx.RequestError) as error:
                if attempt + 1 == self.max_attempts:
                    raise AIClientError("The AI provider could not be reached") from error
            except httpx.HTTPStatusError as error:
                retryable = error.response.status_code == 429 or error.response.status_code >= 500
                if not retryable or attempt + 1 == self.max_attempts:
                    raise AIClientError(
                        f"The AI provider returned HTTP {error.response.status_code}"
                    ) from error
            except (KeyError, IndexError, TypeError, ValueError) as error:
                raise AIClientError("The AI provider returned an invalid response") from error
            await self.sleep(0.2 * (attempt + 1))
        raise AIClientError("The AI provider could not complete the request")

    async def stream(
        self, prompt: str, context: dict[str, object]
    ) -> AsyncIterator[str]:
        request_body = {
            "model": self.model,
            "temperature": 0.2,
            "stream": True,
            "messages": [
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": json.dumps(context, ensure_ascii=False),
                },
            ],
        }
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, transport=self.transport
            ) as client, client.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=request_body,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line.removeprefix("data:").strip()
                    if data == "[DONE]":
                        return
                    try:
                        event = json.loads(data)
                        text = event["choices"][0]["delta"].get("content")
                    except (KeyError, IndexError, TypeError, ValueError) as error:
                        raise AIClientError(
                            "The AI provider returned an invalid stream event"
                        ) from error
                    if isinstance(text, str) and text:
                        yield text
        except (httpx.TimeoutException, httpx.RequestError) as error:
            raise AIClientError("The AI provider could not be reached") from error
        except httpx.HTTPStatusError as error:
            raise AIClientError(
                f"The AI provider returned HTTP {error.response.status_code}"
            ) from error


async def generate(prompt: str, context: dict[str, object]) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AIClientError("OPENAI_API_KEY must be configured")
    client = OpenAIClient(
        api_key=api_key,
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        timeout=float(os.getenv("OPENAI_TIMEOUT_SECONDS", "30")),
    )
    return await client.generate(prompt, context)


async def stream(
    prompt: str, context: dict[str, object]
) -> AsyncIterator[str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AIClientError("OPENAI_API_KEY must be configured")
    client = OpenAIClient(
        api_key=api_key,
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        timeout=float(os.getenv("OPENAI_TIMEOUT_SECONDS", "30")),
    )
    async for part in client.stream(prompt, context):
        yield part
