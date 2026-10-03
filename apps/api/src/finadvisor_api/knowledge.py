import hashlib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

from pgvector.sqlalchemy import Vector
from sqlalchemy import Integer, String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from finadvisor_api.database import Base

EMBEDDING_DIMENSIONS = 16
SAMPLE_RULES = Path(__file__).with_name("knowledge_seed.json")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(300))
    source_url: Mapped[str] = mapped_column(String(2048))
    content: Mapped[str] = mapped_column(String(5000))
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSIONS))


@dataclass(frozen=True)
class KnowledgeResult:
    source: str
    source_url: str
    content: str
    score: float


def embed_text(text: str) -> tuple[float, ...]:
    vector = [0.0] * EMBEDDING_DIMENSIONS
    tokens = re.findall(r"\w+", text.casefold())
    for token in tokens:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=16).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSIONS
        vector[index] += 1.0 if digest[4] & 1 else -1.0
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return tuple(vector)
    return tuple(value / magnitude for value in vector)


def cosine_similarity(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    if len(left) != len(right):
        raise ValueError("Embedding vectors must have equal dimensions")
    left_magnitude = math.sqrt(sum(value * value for value in left))
    right_magnitude = math.sqrt(sum(value * value for value in right))
    if left_magnitude == 0 or right_magnitude == 0:
        return 0.0
    return sum(a * b for a, b in zip(left, right, strict=True)) / (
        left_magnitude * right_magnitude
    )


def _seed_sample_rules(db: Session) -> None:
    with SAMPLE_RULES.open(encoding="utf-8") as seed_file:
        records = json.load(seed_file)
    if not isinstance(records, list) or not 5 <= len(records) <= 10:
        raise ValueError("Sample knowledge seed must contain between 5 and 10 rules")
    for record in records:
        db.add(
            KnowledgeChunk(
                source=record["source"],
                source_url=record["source_url"],
                content=record["content"],
                embedding=list(embed_text(record["content"])),
            )
        )
    db.flush()


def search_knowledge(db: Session, query: str, top_k: int = 5) -> list[KnowledgeResult]:
    if not query.strip():
        raise ValueError("Knowledge search query must not be empty")
    if not 1 <= top_k <= 10:
        raise ValueError("top_k must be between 1 and 10")

    chunk_count = db.scalar(select(func.count()).select_from(KnowledgeChunk))
    if chunk_count == 0:
        _seed_sample_rules(db)

    query_vector = list(embed_text(query))
    distance = KnowledgeChunk.embedding.cosine_distance(query_vector)
    statement = select(KnowledgeChunk).order_by(distance).limit(top_k)
    chunks = db.scalars(statement).all()
    return [
        KnowledgeResult(
            source=chunk.source,
            source_url=chunk.source_url,
            content=chunk.content,
            score=cosine_similarity(tuple(chunk.embedding), tuple(query_vector)),
        )
        for chunk in chunks
    ]
