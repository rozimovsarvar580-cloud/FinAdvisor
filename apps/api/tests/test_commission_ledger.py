from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import CommissionLedger, CommissionStatement, User

client = TestClient(app)


def test_owner_can_list_and_dispute_monthly_commission_statements(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with session_factory() as session:
        user = User(
            id="commission-user",
            email="owner@example.com",
            name="Commission Owner",
            role="tadbirkor",
            subscription_plan="business",
        )
        session.add(user)
        session.commit()

    def override_get_db():
        with session_factory() as session:
            yield session

    user = User(
        id="commission-user",
        email="owner@example.com",
        name="Commission Owner",
        role="tadbirkor",
        subscription_plan="business",
    )

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)

    with session_factory() as session:
        session.add_all(
            [
                CommissionLedger(
                    user_id="commission-user",
                    source_entry_id="source-1",
                    revenue_year=2026,
                    revenue_minor=150000000,
                    commission_minor=5000000,
                    revenue_date=date(2026, 1, 10),
                    currency="UZS",
                    status="accrued",
                ),
                CommissionLedger(
                    user_id="commission-user",
                    source_entry_id="source-2",
                    revenue_year=2026,
                    revenue_minor=200000000,
                    commission_minor=6000000,
                    revenue_date=date(2026, 2, 15),
                    currency="UZS",
                    status="accrued",
                ),
            ]
        )
        session.commit()

    response = client.get("/me/commission-statements")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["revenue_year"] == 2026
    assert payload[0]["statement_month"] in {1, 2}
    assert payload[0]["amount_due_minor"] >= 0

    statement_id = payload[0]["id"]
    dispute = client.post(
        f"/me/commission-statements/{statement_id}/dispute",
        json={"reason": "Revenue number looks wrong."},
    )
    assert dispute.status_code == 200, dispute.text
    assert dispute.json()["status"] == "disputed"
    assert dispute.json()["dispute_reason"] == "Revenue number looks wrong."

    with session_factory() as session:
        statement = session.query(CommissionStatement).filter_by(id=statement_id).one()
        assert statement.status == "disputed"
        assert statement.dispute_reason == "Revenue number looks wrong."
