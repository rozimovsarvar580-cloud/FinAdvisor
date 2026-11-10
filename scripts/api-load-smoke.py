#!/usr/bin/env python3
import argparse
import json
import os
import secrets
import statistics
import sys
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "apps" / "api" / "src"))
sys.path.insert(0, str(REPOSITORY_ROOT / "packages" / "finance-engine" / "src"))

import httpx
from fastapi.testclient import TestClient
from finadvisor_api import plans
from finadvisor_api.ai_client import AIProviderStatus
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import User
from finadvisor_api.security import hash_password
from httpx import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DEFAULT_REQUESTS = 10
MAX_REQUESTS = 20
TARGET_P95_MS = {"login": 2000.0, "plan generation": 500.0, "monthly report": 250.0}
LOGIN_EMAIL = "api-load-smoke@example.com"
LOGIN_PASSWORD = "LocalOnlyPass123!"
FAKE_PLAN = json.dumps(
    {
        "summary": "A concise restaurant business plan.",
        "sections": [
            {"title": "Market overview", "content": "Describe the local market."},
            {"title": "Operations", "content": "Describe daily operations."},
            {"title": "Staffing", "content": "Describe the staffing approach."},
            {"title": "Risks", "content": "Describe business risks."},
        ],
    }
)
PLAN_PAYLOAD = {
    "locale": "en",
    "business_name": "Load Smoke Cafe",
    "restaurant_format": "family",
    "location": "Tashkent",
    "seats": 24,
    "menu_summary": "Local cuisine",
    "average_check": "50000",
    "daily_customers": 20,
    "operating_days_per_month": 25,
    "monthly_rent": "2000000",
    "monthly_utilities": "500000",
    "variable_cost_ratio_percent": "30",
    "staff": [],
    "equipment": [],
    "other_startup_cost": "0",
    "loan_amount": "0",
    "annual_interest_rate_percent": "0",
    "loan_term_months": 0,
    "target_monthly_profit": "0",
}


def _p95(samples_ms: list[float]) -> float:
    ordered = sorted(samples_ms)
    return ordered[max(0, (95 * len(ordered) + 99) // 100 - 1)]


def _measure(
    name: str,
    requests_per_route: int,
    request: Callable[[], Response],
    expected_status: int,
) -> tuple[list[float], list[str]]:
    samples_ms = []
    failures = []
    for index in range(requests_per_route):
        started = time.perf_counter()
        try:
            response = request()
        except httpx.HTTPError as error:
            failures.append(f"{name} request {index + 1}: {type(error).__name__}")
            continue
        samples_ms.append((time.perf_counter() - started) * 1000)
        if response.status_code != expected_status:
            failures.append(f"{name} request {index + 1}: HTTP {response.status_code}")
    return samples_ms, failures


def run_smoke(
    requests_per_route: int = DEFAULT_REQUESTS,
    max_p95_ms: float | None = None,
) -> int:
    if not 1 <= requests_per_route <= MAX_REQUESTS:
        raise ValueError(f"requests_per_route must be between 1 and {MAX_REQUESTS}")
    targets = dict(TARGET_P95_MS)
    if max_p95_ms is not None:
        if max_p95_ms <= 0:
            raise ValueError("max_p95_ms must be greater than zero")
        targets = {name: max_p95_ms for name in targets}

    previous_jwt_secret = os.environ.get("JWT_SECRET")
    os.environ["JWT_SECRET"] = secrets.token_urlsafe(32)
    missing = object()
    previous_db_override = app.dependency_overrides.get(get_db, missing)
    previous_generate = plans.generate
    previous_ai_status = plans.get_ai_provider_status
    engine = None
    temp_db = Path(tempfile.gettempdir()) / f"finadvisor-api-load-{secrets.token_hex(8)}.db"
    try:
        engine = create_engine(f"sqlite:///{temp_db.as_posix()}")
        Base.metadata.create_all(bind=engine)
        session_factory = sessionmaker(
            bind=engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )

        def override_get_db():
            with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        with session_factory() as session:
            session.add(
                User(
                    id="api-load-smoke-owner",
                    email=LOGIN_EMAIL,
                    name="Load Smoke Owner",
                    role="tadbirkor",
                    subscription_plan="business",
                    email_verified=True,
                    password_hash=hash_password(LOGIN_PASSWORD),
                )
            )
            session.commit()

        async def fake_generate(prompt: str, context: dict[str, object]) -> str:
            return FAKE_PLAN

        plans.generate = fake_generate
        plans.get_ai_provider_status = lambda: AIProviderStatus(
            connected=True,
            provider="openai",
            model="load-smoke-fake",
        )

        samples: dict[str, list[float]] = {}
        failures = []
        login_tokens = []
        with TestClient(app) as client:
            def login_request() -> Response:
                response = client.post(
                    "/auth/login",
                    json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
                )
                if response.status_code == 200:
                    token = response.json().get("access_token")
                    if isinstance(token, str):
                        login_tokens.append(token)
                return response

            login_samples, login_failures = _measure(
                "login",
                requests_per_route,
                login_request,
                200,
            )
            samples["login"] = login_samples
            failures.extend(login_failures)

            token = login_tokens[-1] if login_tokens else None
            if not isinstance(token, str):
                failures.append("Could not obtain an access token for protected routes")
            else:
                headers = {"Authorization": f"Bearer {token}"}
                plan_samples, plan_failures = _measure(
                    "plan generation",
                    requests_per_route,
                    lambda: client.post(
                        "/plans/generate",
                        json=PLAN_PAYLOAD,
                        headers=headers,
                    ),
                    200,
                )
                report_samples, report_failures = _measure(
                    "monthly report",
                    requests_per_route,
                    lambda: client.get("/reports/month", headers=headers),
                    200,
                )
                samples["plan generation"] = plan_samples
                samples["monthly report"] = report_samples
                failures.extend(plan_failures)
                failures.extend(report_failures)

        for name, target in targets.items():
            route_samples = samples.get(name, [])
            if not route_samples:
                failures.append(f"{name}: no successful timing samples")
                continue
            p50_ms = statistics.median(route_samples)
            p95_ms = _p95(route_samples)
            print(
                f"{name}: {len(route_samples)}/{requests_per_route} responses, "
                f"p50={p50_ms:.1f}ms, p95={p95_ms:.1f}ms "
                f"(target <= {target:.0f}ms)"
            )
            if p95_ms > target:
                failures.append(f"{name}: p95 exceeded target")

        if failures:
            for failure in failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1
        print("API load smoke passed (in-process; fake AI; no external services).")
        return 0
    finally:
        plans.generate = previous_generate
        plans.get_ai_provider_status = previous_ai_status
        if previous_db_override is missing:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_db_override
        if engine is not None:
            Base.metadata.drop_all(bind=engine)
            engine.dispose()
        temp_db.unlink(missing_ok=True)
        if previous_jwt_secret is None:
            os.environ.pop("JWT_SECRET", None)
        else:
            os.environ["JWT_SECRET"] = previous_jwt_secret


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Exercise login, fake-AI plan generation, and monthly report routes."
    )
    parser.add_argument(
        "--requests",
        type=int,
        default=DEFAULT_REQUESTS,
        help=f"sequential requests per route (1-{MAX_REQUESTS}; default: {DEFAULT_REQUESTS})",
    )
    parser.add_argument(
        "--max-p95-ms",
        type=float,
        help="override each documented per-route p95 target",
    )
    arguments = parser.parse_args(argv)
    try:
        return run_smoke(arguments.requests, arguments.max_p95_ms)
    except ValueError as error:
        parser.error(str(error))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
