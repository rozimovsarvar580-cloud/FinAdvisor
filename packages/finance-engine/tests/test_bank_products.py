from pathlib import Path

import yaml

CATALOG_PATH = (
    Path(__file__).parents[1]
    / "src"
    / "finance_engine"
    / "bank_products_2026.yaml"
)


def test_bank_product_catalog_has_provenance_and_no_unverified_terms() -> None:
    with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
        catalog = yaml.safe_load(catalog_file)

    assert catalog["version"] == 1
    assert catalog["jurisdiction"] == "UZ"
    assert catalog["verified"] is False
    assert catalog["verified_by"] is None
    assert catalog["products"]
    for product in catalog["products"]:
        assert product["source_url"] == "TODO(VERIFY)"
        assert product["effective_date"] == "TODO(VERIFY)"
        assert product["verified"] is False
        assert product["verified_by"] is None
        assert product["annual_interest_rate_percent"] is None
        assert product["term_months_min"] is None
        assert product["term_months_max"] is None
