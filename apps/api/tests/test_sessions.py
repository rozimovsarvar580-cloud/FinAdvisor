from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.session_repository import create_session, get_active_session


def test_auth_session_can_be_created_and_loaded():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        created = create_session(db, "token-001", "demo@finadvisor.uz")
        loaded = get_active_session(db, created.token)
        assert loaded is not None
        assert loaded.user_email == "demo@finadvisor.uz"
