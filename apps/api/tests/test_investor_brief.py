from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base, get_db
from finadvisor_api.investor_brief import CONSENT_VERSION, render_investor_brief_pdf
from finadvisor_api.main import app
from finadvisor_api.models import InvestorBriefLead


@pytest.fixture
def investor_brief_context():
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


def test_investor_pdf_is_generated_from_the_document_source():
    reader = PdfReader(BytesIO(render_investor_brief_pdf()))
    text = " ".join(
        " ".join(page.extract_text() or "" for page in reader.pages).split()
    )

    assert reader.pages
    assert "Investor Brief" in text
    assert "Market" in text
    assert "Revenue model" in text
    assert "Likely investor questions" in text
    assert text.count("TODO(VERIFY)") >= 10


def test_investor_brief_requires_consent_and_records_request(investor_brief_context):
    client = TestClient(app)
    rejected = client.post(
        "/investor-brief/download",
        json={"email": "owner@example.com", "consent": False, "locale": "en"},
    )
    assert rejected.status_code == 422
    assert investor_brief_context.query(InvestorBriefLead).count() == 0

    response = client.post(
        "/investor-brief/download",
        json={"email": "Owner@Example.com", "consent": True, "locale": "ru"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "inline" in response.headers["content-disposition"]
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith(b"%PDF-")
    lead = investor_brief_context.query(InvestorBriefLead).one()
    assert lead.email == "owner@example.com"
    assert lead.consented is True
    assert lead.consent_version == CONSENT_VERSION
    assert lead.locale == "ru"
