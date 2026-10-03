import pytest
from sqlalchemy.orm import Session

from finadvisor_api.knowledge import (
    EMBEDDING_DIMENSIONS,
    cosine_similarity,
    embed_text,
    search_knowledge,
)


def test_embedding_is_normalized_and_repeatable() -> None:
    embedding = embed_text("restaurant loan repayment")

    assert len(embedding) == EMBEDDING_DIMENSIONS
    assert embedding == embed_text("restaurant loan repayment")
    assert cosine_similarity(embedding, embedding) == pytest.approx(1.0)


def test_cosine_similarity_rejects_mismatched_dimensions() -> None:
    with pytest.raises(ValueError):
        cosine_similarity((1.0, 0.0), (1.0,))


def test_search_knowledge_rejects_empty_query_and_invalid_top_k() -> None:
    db = Session()
    with pytest.raises(ValueError):
        search_knowledge(db, "", 5)
    with pytest.raises(ValueError):
        search_knowledge(db, "restaurant", 11)
    db.close()
