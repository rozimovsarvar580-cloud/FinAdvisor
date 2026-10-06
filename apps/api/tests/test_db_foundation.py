from decimal import Decimal

from app.models import Plan


def test_plan_model_keeps_money_as_decimal_and_currency():
    plan = Plan(
        id="plan-test",
        name="Test Bistro",
        monthly_revenue=Decimal("1000000.00"),
        monthly_profit=Decimal("250000.00"),
    )
    assert plan.currency == "UZS"
    assert isinstance(plan.monthly_revenue, Decimal)
