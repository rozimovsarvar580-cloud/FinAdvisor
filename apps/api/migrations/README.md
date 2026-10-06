# Database migrations

Alembic migrations belong in this directory. The SQLAlchemy base and `Plan`
model are defined in `app/db.py` and `app/models.py`; production migrations
must be generated and reviewed before deployment.
