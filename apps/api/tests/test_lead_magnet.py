from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base, get_db
from finadvisor_api.lead_magnet import CONSENT_VERSION, LEAD_MAGNET_MESSAGES, render_sample_plan_pdf
from finadvisor_api.main import app
from finadvisor_api.models import SamplePlanLead


@pytest.fixture
def lead_magnet_context():
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


@pytest.mark.parametrize("locale", ["uz", "ru", "en"])
def test_sample_plan_pdf_is_localized_and_uses_no_invented_financial_values(locale: str):
    pdf = render_sample_plan_pdf(locale)
    reader = PdfReader(BytesIO(pdf))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)

    assert pdf.startswith(b"%PDF-")
    assert len(reader.pages) >= 1
    assert LEAD_MAGNET_MESSAGES[locale]["title"] in text
    assert all(
        section["title"] in text
        for section in LEAD_MAGNET_MESSAGES[locale]["sections"]
    )
    normalized_text = " ".join(text.split())
    assert " ".join(LEAD_MAGNET_MESSAGES[locale]["disclaimer"].split()) in normalized_text
    assert "UZS" not in text
    assert "100,000" not in text


def test_download_requires_explicit_consent_and_records_request(lead_magnet_context):
    client = TestClient(app)
    rejected = client.post(
        "/lead-magnet/sample-plan",
        json={"email": "owner@example.com", "consent": False, "locale": "en"},
    )
    assert rejected.status_code == 422
    assert lead_magnet_context.query(SamplePlanLead).count() == 0

    response = client.post(
        "/lead-magnet/sample-plan",
        json={"email": "Owner@Example.com", "consent": True, "locale": "en"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    lead = lead_magnet_context.query(SamplePlanLead).one()
    assert lead.email == "owner@example.com"
    assert lead.consented is True
    assert lead.consent_version == CONSENT_VERSION
    assert lead.locale == "en"


def test_download_rejects_invalid_email_and_locale(lead_magnet_context):
    client = TestClient(app)
    for payload in (
        {"email": "not-an-email", "consent": True, "locale": "en"},
        {"email": "owner@example.com", "consent": True, "locale": "fr"},
    ):
        response = client.post("/lead-magnet/sample-plan", json=payload)
        assert response.status_code == 422
    assert lead_magnet_context.query(SamplePlanLead).count() == 0
