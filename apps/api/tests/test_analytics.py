import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import FunnelEvent, User


@pytest.fixture
def analytics_context():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    db = factory()
    admin = User(id="funnel-admin", email="funnel@example.com", name="Admin", role="admin")
    db.add(admin)
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    yield db
    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_event_requires_explicit_consent_and_is_stored(analytics_context):
    client = TestClient(app)
    rejected = client.post("/analytics/events", json={"event": "visit", "consent": False, "visitor_id": "visitor_identifier_123"})
    assert rejected.status_code == 400
    accepted = client.post("/analytics/events", json={"event": "visit", "consent": True, "visitor_id": "visitor_identifier_123"})
    assert accepted.status_code == 202
    assert analytics_context.query(FunnelEvent).one().event == "visit"


def test_admin_funnel_aggregates_consented_events_and_rejects_non_admin(analytics_context):
    analytics_context.add_all([FunnelEvent(event="signup"), FunnelEvent(event="paid")])
    analytics_context.commit()
    response = TestClient(app).get("/analytics/funnel")
    assert response.json()["counts"]["signup"] == 1
    assert response.json()["counts"]["paid"] == 1
    app.dependency_overrides[get_current_user] = lambda: User(id="owner", email="owner@example.com", name="Owner", role="tadbirkor")
    assert TestClient(app).get("/analytics/funnel").status_code == 403
