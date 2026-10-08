from fastapi.testclient import TestClient

from finadvisor_api.main import app

client = TestClient(app)


def test_pricing_plans_match_decision_d1_and_share_the_web_catalog() -> None:
    response = client.get("/pricing/plans")

    assert response.status_code == 200
    catalog = response.json()
    assert catalog["billingPeriods"] == ["weekly", "monthly", "yearly"]
    assert catalog["placeholderMarker"] == "TODO(DECISION D1)"
    assert catalog["placeholderPeriods"] == ["monthly", "yearly"]
    assert [
        (plan["id"], plan["priceByPeriod"], plan["featureKeys"])
        for plan in catalog["plans"]
    ] == [
        (
            "free",
            {"weekly": "$0", "monthly": "$0", "yearly": "$0"},
            ["onePlan", "basicCalculations", "webPreview"],
        ),
        (
            "pro",
            {"weekly": "$10", "monthly": "$40", "yearly": "$384"},
            [
                "aiAnalysis",
                "credit",
                "tax",
                "revenue",
                "profit",
                "calculators",
                "businessPlan",
            ],
        ),
        (
            "business",
            {"weekly": "$20", "monthly": "$80", "yearly": "$768"},
            [
                "aiAnalysis",
                "credit",
                "tax",
                "revenue",
                "profit",
                "calculators",
                "businessPlan",
                "agentSynergy",
                "desktopAgent",
                "accountantOwnerAccounts",
            ],
        ),
    ]
