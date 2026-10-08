from fastapi.testclient import TestClient

from finadvisor_api.legacy.main import app as legacy_app
from finadvisor_api.main import app


def test_legacy_routes_are_registered_on_canonical_api() -> None:
    client = TestClient(app)
    routes = {
        "/api/v1/accounting/daily": 401,
        "/api/v1/workspace/dashboard": 200,
        "/api/v1/plans/plan-001/export.csv": 200,
        "/api/v1/wizard/steps": 200,
        "/api/v1/admin/users": 200,
        "/api/v1/investors/discover": 200,
    }

    for path, expected_status in routes.items():
        assert client.get(path).status_code == expected_status


def test_legacy_entrypoint_aliases_canonical_api() -> None:
    assert legacy_app is app
