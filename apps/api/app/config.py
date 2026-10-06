import os


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./finadvisor.db",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
