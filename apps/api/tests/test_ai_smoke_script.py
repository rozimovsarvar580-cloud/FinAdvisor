import asyncio
import importlib.util
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "ai-smoke.py"
SPEC = importlib.util.spec_from_file_location("ai_smoke", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
ai_smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ai_smoke)


def test_ai_smoke_reports_success_without_printing_provider_response(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        assert prompt == "Reply with the single word OK."
        assert context == {"purpose": "configuration smoke test"}
        return "OK"

    monkeypatch.setattr(ai_smoke.ai_client, "generate", fake_generate)

    assert asyncio.run(ai_smoke.run_smoke()) == 0
    captured = capsys.readouterr()
    assert captured.out == "AI smoke OK\n"
    assert captured.err == ""


def test_ai_smoke_reports_safe_provider_error(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        raise ai_smoke.ai_client.AIClientError(
            "The AI provider could not be reached"
        )

    monkeypatch.setattr(ai_smoke.ai_client, "generate", fake_generate)

    assert asyncio.run(ai_smoke.run_smoke()) == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == "AI smoke failed: The AI provider could not be reached\n"
