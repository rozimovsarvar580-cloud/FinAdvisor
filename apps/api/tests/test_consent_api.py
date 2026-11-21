import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import AnalyticsConsent


@pytest.fixture
def consent_context():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    db = factory()
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.mark.parametrize("consent", [True, False])
def test_anonymous_visitor_can_save_and_update_analytics_choice(
    consent_context, consent
):
    client = TestClient(app)
    visitor_id = "anonymous_visitor_123"

    response = client.post(
        "/analytics/consent",
        json={"visitor_id": visitor_id, "consent": consent},
    )

    assert response.status_code == 202
    assert response.json() == {"recorded": True}
    record = consent_context.scalar(
        select(AnalyticsConsent).where(AnalyticsConsent.visitor_id == visitor_id)
    )
    assert record is not None
    assert record.consented is consent
