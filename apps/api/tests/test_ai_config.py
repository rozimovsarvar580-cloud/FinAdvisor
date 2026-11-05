import json

import pytest

from finadvisor_api import ai_client
from finadvisor_api.ai_client import AIClientError, get_ai_provider_config


@pytest.fixture(autouse=True)
def clear_ai_config_cache():
    get_ai_provider_config.cache_clear()
    yield
    get_ai_provider_config.cache_clear()


def test_file_configuration_takes_precedence_and_is_cached(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config_path = tmp_path / "test-ai-config.json"
    config_path.write_text(
        json.dumps(
            {"provider": "openai", "api_key": "file-test-key", "model": "file-model"}
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(ai_client, "AI_CONFIG_PATH", config_path)
    monkeypatch.setenv("OPENAI_API_KEY", "environment-test-key")
    monkeypatch.setenv("OPENAI_MODEL", "environment-model")

    loaded = get_ai_provider_config()
    config_path.write_text(
        json.dumps(
            {"provider": "openai", "api_key": "changed-test-key", "model": "changed"}
        ),
        encoding="utf-8",
    )

    assert loaded.provider == "openai"
    assert loaded.api_key == "file-test-key"
    assert loaded.model == "file-model"
    assert get_ai_provider_config() is loaded
    assert "file-test-key" not in repr(loaded)


def test_environment_key_is_used_when_config_file_is_missing(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ai_client, "AI_CONFIG_PATH", tmp_path / "missing-config.json")
    monkeypatch.setenv("OPENAI_API_KEY", "environment-test-key")
    monkeypatch.setenv("OPENAI_MODEL", "environment-model")

    loaded = get_ai_provider_config()

    assert loaded.provider == "openai"
    assert loaded.api_key == "environment-test-key"
    assert loaded.model == "environment-model"


def test_missing_configuration_raises_explicit_error_without_key_material(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ai_client, "AI_CONFIG_PATH", tmp_path / "missing-config.json")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(AIClientError, match="ai.config.json or OPENAI_API_KEY") as error:
        get_ai_provider_config()

    assert "test-key" not in str(error.value)


@pytest.mark.parametrize(
    ("contents", "message"),
    [
        ("", "not valid JSON"),
        ('{"provider":"unknown","api_key":"private-test-key","model":"m"}', "not supported"),
        ('{"provider":"openai","api_key":"","model":"m"}', "API key"),
        ('{"provider":"openai","api_key":"private-test-key","model":""}', "model"),
        ("[]", "must contain an object"),
    ],
)
def test_invalid_file_configuration_fails_explicitly_without_leaking_key(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    contents: str,
    message: str,
) -> None:
    config_path = tmp_path / "test-ai-config.json"
    config_path.write_text(contents, encoding="utf-8")
    monkeypatch.setattr(ai_client, "AI_CONFIG_PATH", config_path)

    with pytest.raises(AIClientError, match=message) as error:
        get_ai_provider_config()

    assert "private-test-key" not in str(error.value)
