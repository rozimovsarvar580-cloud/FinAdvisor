from fastapi.testclient import TestClient

from finadvisor_api.main import app

client = TestClient(app)


def test_commission_endpoint_returns_progressive_breakdown() -> None:
    response = client.post(
        "/pricing/commission",
        json={"annual_revenue": "1100000000"},
    )

    assert response.status_code == 200
    assert response.json()["total_commission"] == "23000000.00"
    assert [band["revenue_portion"] for band in response.json()["bands"]] == [
        "100000000",
        "900000000",
        "100000000",
    ]


def test_commission_endpoint_rejects_negative_and_float_input() -> None:
    negative = client.post("/pricing/commission", json={"annual_revenue": "-1"})
    float_value = client.post("/pricing/commission", json={"annual_revenue": 100000000})

    assert negative.status_code == 422
    assert float_value.status_code == 422
