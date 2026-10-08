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
    excess_precision = client.post(
        "/pricing/commission",
        json={"annual_revenue": "1.234"},
    )
    exponent = client.post("/pricing/commission", json={"annual_revenue": "1e3"})

    assert negative.status_code == 422
    assert float_value.status_code == 422
    assert excess_precision.status_code == 422
    assert exponent.status_code == 422


def test_commission_endpoint_returns_exact_150m_response_shape() -> None:
    response = client.post(
        "/pricing/commission",
        json={"annual_revenue": "150000000"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "annual_revenue": "150000000",
        "total_commission": "5000000.00",
        "bands": [
            {
                "tier": "first_100m",
                "revenue_portion": "100000000",
                "rate_percent": "4.00",
                "commission": "4000000.00",
            },
            {
                "tier": "next_900m",
                "revenue_portion": "50000000",
                "rate_percent": "2.00",
                "commission": "1000000.00",
            },
            {
                "tier": "above_1b",
                "revenue_portion": "0",
                "rate_percent": "1.00",
                "commission": "0.00",
            },
        ],
    }
