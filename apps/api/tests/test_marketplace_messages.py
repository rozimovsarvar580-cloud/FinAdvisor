import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import MarketplaceListing, User


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setattr(auth_module, "send_auth_email", lambda *args: None)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    app.state.test_session_factory = factory

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def register(client: TestClient, email: str, role: str) -> dict[str, str]:
    response = client.post("/auth/register", json={"email": email, "name": role, "password": "StrongPass123!", "role": role})
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_contact_acceptance_thread_notifications_and_rate_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from finadvisor_api import marketplace

    notified: list[str] = []
    monkeypatch.setattr(marketplace, "send_marketplace_email", lambda recipient, locale, subject, body: notified.append(recipient))
    monkeypatch.setattr(marketplace, "send_investor_contact_request_email", lambda recipient, locale, investor, business, message: notified.append(recipient))
    owner = register(client, "owner@example.com", "tadbirkor")
    investor = register(client, "investor@example.com", "investor")
    outsider = register(client, "outsider@example.com", "investor")
    with client.app.state.test_session_factory() as db:
        owner_user = db.scalar(select(User).where(User.email == "owner@example.com"))
        assert owner_user is not None
        listing = MarketplaceListing(id="listing-1", owner_id=owner_user.id, business_name="Cafe", city="Tashkent", stage="pilot", funding_target="1000", currency="UZS", summary="A cafe", status="published", is_published=True, public_financial_fields=[], request_financial_fields=[])
        db.add(listing)
        db.commit()

    request = client.post("/marketplace/listings/listing-1/contacts", json={"message": "Interested"}, headers=investor)
    assert request.status_code == 201
    contact_id = request.json()["id"]
    assert notified == ["owner@example.com"]
    assert client.post(f"/marketplace/listings/contacts/{contact_id}/messages", json={"content": "Before approval"}, headers=investor).status_code == 409
    assert client.patch(f"/marketplace/listings/contacts/{contact_id}", json={"status": "accepted"}, headers=owner).status_code == 200
    assert notified[-1] == "investor@example.com"
    sent = client.post(f"/marketplace/listings/contacts/{contact_id}/messages", json={"content": "Welcome"}, headers=investor)
    assert sent.status_code == 201
    assert client.get(f"/marketplace/listings/contacts/{contact_id}/messages", headers=owner).json()["items"][0]["content"] == "Welcome"
    assert client.get(f"/marketplace/listings/contacts/{contact_id}/messages", headers=outsider).status_code == 404
    assert notified[-1] == "owner@example.com"
    for index in range(9):
        # The contact action limit applies across request and message endpoints.
        status = client.post(f"/marketplace/listings/contacts/{contact_id}/messages", json={"content": f"Message {index}"}, headers=investor).status_code
    assert status == 429


def test_only_investors_can_contact_and_owners_cannot_message_declined_requests(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "tadbirkor")
    investor = register(client, "investor@example.com", "investor")
    with client.app.state.test_session_factory() as db:
        owner_user = db.scalar(select(User).where(User.email == "owner@example.com"))
        assert owner_user is not None
        db.add(MarketplaceListing(id="listing-2", owner_id=owner_user.id, business_name="Cafe", city="Tashkent", stage="pilot", funding_target="1000", currency="UZS", summary="A cafe", status="published", is_published=True, public_financial_fields=[], request_financial_fields=[]))
        db.commit()
    assert client.post("/marketplace/listings/listing-2/contacts", json={"message": "Hi"}, headers=owner).status_code == 403
    contact = client.post("/marketplace/listings/listing-2/contacts", json={"message": "Hi"}, headers=investor).json()
    assert client.patch(f"/marketplace/listings/contacts/{contact['id']}", json={"status": "declined"}, headers=owner).status_code == 200
    assert client.post(f"/marketplace/listings/contacts/{contact['id']}/messages", json={"content": "Hello"}, headers=owner).status_code == 409


def test_listing_and_message_reports_admin_review_hide_ban_and_audit(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "tadbirkor")
    investor = register(client, "investor@example.com", "investor")
    admin = register(client, "admin@example.com", "tadbirkor")
    with client.app.state.test_session_factory() as db:
        admin_user = db.scalar(select(User).where(User.email == "admin@example.com"))
        assert admin_user is not None
        admin_user.role = "admin"
        db.commit()
    with client.app.state.test_session_factory() as db:
        owner_user = db.scalar(select(User).where(User.email == "owner@example.com"))
        assert owner_user is not None
        db.add(MarketplaceListing(id="listing-mod", owner_id=owner_user.id, business_name="Cafe", city="Tashkent", stage="pilot", funding_target="1000", currency="UZS", summary="A cafe", status="published", is_published=True, public_financial_fields=[], request_financial_fields=[]))
        db.commit()
    listing_report = client.post("/marketplace/listings/listing-mod/reports", json={"reason": "Misleading information"}, headers=investor)
    assert listing_report.status_code == 201
    assert client.get("/admin/moderation", headers=admin).json()["items"][0]["target_type"] == "listing"
    reviewed = client.patch(f"/admin/moderation/{listing_report.json()['id']}", json={"action": "hide"}, headers=admin)
    assert reviewed.status_code == 200
    assert client.get("/marketplace/listings/listing-mod").status_code == 404
    assert client.get("/admin/moderation/audit", headers=admin).json()["items"][0]["action"] == "hide"

    with client.app.state.test_session_factory() as db:
        owner_user = db.scalar(select(User).where(User.email == "owner@example.com"))
        assert owner_user is not None
        db.add(MarketplaceListing(id="listing-ban", owner_id=owner_user.id, business_name="Cafe", city="Tashkent", stage="pilot", funding_target="1000", currency="UZS", summary="A cafe", status="published", is_published=True, public_financial_fields=[], request_financial_fields=[]))
        db.commit()
    contact = client.post("/marketplace/listings/listing-ban/contacts", json={"message": "Interested"}, headers=investor).json()
    assert client.patch(f"/marketplace/listings/contacts/{contact['id']}", json={"status": "accepted"}, headers=owner).status_code == 200
    message = client.post(f"/marketplace/listings/contacts/{contact['id']}/messages", json={"content": "Please invest"}, headers=owner).json()
    message_report = client.post(f"/marketplace/listings/contacts/messages/{message['id']}/reports", json={"reason": "Harassment"}, headers=investor)
    assert message_report.status_code == 201
    assert client.patch(f"/admin/moderation/{message_report.json()['id']}", json={"action": "ban"}, headers=admin).status_code == 200
    assert client.get("/auth/me", headers=owner).status_code == 403
