import importlib.util
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "api-load-smoke.py"
SPEC = importlib.util.spec_from_file_location("api_load_smoke", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
api_load_smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(api_load_smoke)


def test_api_load_smoke_exercises_routes_with_fake_ai(capsys) -> None:
    assert api_load_smoke.run_smoke(requests_per_route=1, max_p95_ms=10_000) == 0

    output = capsys.readouterr().out
    assert "login: 1/1 responses" in output
    assert "plan generation: 1/1 responses" in output
    assert "monthly report: 1/1 responses" in output
    assert "fake AI" in output


def test_api_load_smoke_rejects_more_requests_than_supported() -> None:
    try:
        api_load_smoke.run_smoke(requests_per_route=api_load_smoke.MAX_REQUESTS + 1)
    except ValueError as error:
        assert "requests_per_route" in str(error)
    else:
        raise AssertionError("request counts above the configured limit must fail")
