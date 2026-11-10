from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.database import SessionLocal
from finadvisor_api.demo_account import DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_ID
from finadvisor_api.models import (
    AccountingRecord,
    MarketplaceListing,
    SavedBusinessPlan,
    User,
)
from finadvisor_api.plan_schemas import (
    GeneratedPlanContent,
    PlanGenerateRequest,
    PlanGenerateResponse,
)
from finadvisor_api.plans import _plan_context

DEMO_PLAN_ID = "plan-demo-restaurant"
DEMO_LISTING_ID = "listing-demo-restaurant"


def _demo_plan() -> tuple[PlanGenerateRequest, dict[str, object]]:
    assumptions = PlanGenerateRequest(
        locale="uz",
        business_name="Namuna restorani",
        restaurant_format="cafe",
        location="Namuna joylashuvi",
        seats=30,
        menu_summary="Namoyish uchun yaratilgan namunaviy menyu.",
        average_check="50000",
        daily_customers=40,
        operating_days_per_month=26,
        monthly_rent="5000000",
        monthly_utilities="1000000",
        variable_cost_ratio_percent="35",
        staff=[
            {"role": "Oshpaz", "employee_count": 2, "monthly_salary": "4000000"},
            {"role": "Xizmat ko‘rsatuvchi", "employee_count": 2, "monthly_salary": "2500000"},
        ],
        equipment=[],
        other_startup_cost="10000000",
        loan_amount="0",
        annual_interest_rate_percent="0",
        loan_term_months=0,
        target_monthly_profit="0",
    )
    calculations, _ = _plan_context(assumptions)
    content = GeneratedPlanContent(
        summary="Namoyish uchun tayyorlangan namunaviy restoran rejasi.",
        sections=[
            {
                "title": "Faoliyat modeli",
                "content": "Ushbu reja faqat mahsulot imkoniyatlarini namoyish qilish uchun yaratilgan.",
            },
            {
                "title": "Operatsiyalar",
                "content": "Menyu, ish jadvali va xodimlar haqidagi ma’lumotlar sun’iy namunadir.",
            },
            {
                "title": "Xatarlar",
                "content": "Haqiqiy biznes qaroridan oldin barcha taxminlarni mustaqil tekshiring.",
            },
        ],
    )
    response = PlanGenerateResponse(
        summary=content.summary,
        sections=content.sections,
        markdown="\n\n".join(
            [f"# {content.summary}"]
            + [f"## {section.title}\n\n{section.content}" for section in content.sections]
        ),
        calculations=calculations,
        assumptions=assumptions,
    )
    created_at = datetime.now(UTC).isoformat()
    snapshot = {
        "version": 1,
        "created_at": created_at,
        "summary": response.summary,
        "sections": [section.model_dump(mode="json") for section in response.sections],
        "markdown": response.markdown,
    }
    return assumptions, {
        **response.model_dump(mode="json"),
        "version": 1,
        "versions": [snapshot],
    }


def seed_demo(db: Session) -> None:
    today = datetime.now(UTC).date().isoformat()
    user = db.scalar(select(User).where(User.email == DEMO_ACCOUNT_EMAIL))
    if user is not None and (not user.is_demo or user.id != DEMO_ACCOUNT_ID):
        raise RuntimeError(
            f"{DEMO_ACCOUNT_EMAIL} already belongs to a non-demo account; refusing to modify it"
        )
    existing_id = db.get(User, DEMO_ACCOUNT_ID)
    if existing_id is not None and existing_id.email != DEMO_ACCOUNT_EMAIL:
        raise RuntimeError("The fixed demo account ID is already in use")

    if user is None:
        user = User(
            id=DEMO_ACCOUNT_ID,
            email=DEMO_ACCOUNT_EMAIL,
            name="FinAdvisor Demo Restaurant",
            role="tadbirkor",
            is_demo=True,
            is_suspended=False,
            subscription_plan="free",
            saved_plan_count=1,
            marketplace_listing_count=1,
            needs_role=False,
            locale="uz",
            auth_provider="credentials",
            password_hash=None,
            email_verified=True,
        )
        db.add(user)
    else:
        user.name = "FinAdvisor Demo Restaurant"
        user.role = "tadbirkor"
        user.is_demo = True
        user.is_suspended = False
        user.subscription_plan = "free"
        user.saved_plan_count = 1
        user.marketplace_listing_count = 1
        user.needs_role = False
        user.locale = "uz"
        user.password_hash = None
        user.email_verified = True

    assumptions, generated_plan = _demo_plan()
    plan = db.get(SavedBusinessPlan, DEMO_PLAN_ID)
    if plan is not None and plan.owner_id != user.id:
        raise RuntimeError("The fixed demo plan ID is already owned by another account")
    if plan is None:
        plan = SavedBusinessPlan(
            id=DEMO_PLAN_ID,
            owner_id=user.id,
            business_name=assumptions.business_name,
            location=assumptions.location,
            request_payload=assumptions.model_dump(mode="json"),
            generated_plan=generated_plan,
        )
        db.add(plan)
    else:
        plan.owner_id = user.id
        plan.business_name = assumptions.business_name
        plan.location = assumptions.location
        plan.request_payload = assumptions.model_dump(mode="json")
        plan.generated_plan = generated_plan

    sample_records = [
        (
            "inventory",
            "demo-inventory-rice",
            {"name": "Guruch (namuna)", "category": "Masalliqlar", "quantity": "25", "unit": "kg"},
        ),
        (
            "sales",
            "demo-sale-today",
            {
                "date": today,
                "amount": "750000",
                "description": "Namunaviy kunlik savdo",
            },
        ),
        (
            "expenses",
            "demo-expense-today",
            {
                "date": today,
                "amount": "250000",
                "category": "Masalliqlar",
                "description": "Namunaviy xarajat",
            },
        ),
        (
            "stock-movements",
            "demo-stock-in",
            {
                "date": today,
                "direction": "in",
                "quantity": "25",
                "description": "Namunaviy kirim",
            },
        ),
        (
            "employees",
            "demo-employee-chef",
            {"name": "Namuna xodim", "role": "Oshpaz", "monthly_salary": "4000000"},
        ),
    ]
    for resource, client_id, data in sample_records:
        record = db.scalar(
            select(AccountingRecord).where(
                AccountingRecord.owner_id == user.id,
                AccountingRecord.resource == resource,
                AccountingRecord.client_id == client_id,
            )
        )
        fixed_id = f"accounting-{client_id}"
        fixed_record = db.get(AccountingRecord, fixed_id)
        if fixed_record is not None and fixed_record.owner_id != user.id:
            raise RuntimeError("A fixed demo accounting record ID is already in use")
        if record is None:
            db.add(
                AccountingRecord(
                    id=fixed_id,
                    owner_id=user.id,
                    resource=resource,
                    client_id=client_id,
                    data=data,
                )
            )
        else:
            record.data = data

    listing = db.get(MarketplaceListing, DEMO_LISTING_ID)
    if listing is not None and listing.owner_id != user.id:
        raise RuntimeError("The fixed demo listing ID is already owned by another account")
    if listing is None:
        listing = MarketplaceListing(
            id=DEMO_LISTING_ID,
            owner_id=user.id,
            saved_plan_id=DEMO_PLAN_ID,
            business_name="DEMO • Namuna restorani",
            city="Namuna joylashuvi",
            stage="idea",
            funding_target=Decimal(100000000),
            currency="UZS",
            summary=(
                "Faqat namoyish uchun yaratilgan sun’iy e’lon. "
                "Haqiqiy biznes yoki sarmoya taklifi emas."
            ),
            is_published=True,
            status="published",
            public_financial_fields=[],
            request_financial_fields=[],
        )
        db.add(listing)
    else:
        listing.owner_id = user.id
        listing.saved_plan_id = DEMO_PLAN_ID
        listing.business_name = "DEMO • Namuna restorani"
        listing.city = "Namuna joylashuvi"
        listing.stage = "idea"
        listing.funding_target = Decimal(100000000)
        listing.currency = "UZS"
        listing.summary = (
            "Faqat namoyish uchun yaratilgan sun’iy e’lon. "
            "Haqiqiy biznes yoki sarmoya taklifi emas."
        )
        listing.is_published = True
        listing.status = "published"
        listing.public_financial_fields = []
        listing.request_financial_fields = []

    db.commit()


def main() -> None:
    with SessionLocal() as db:
        seed_demo(db)
    print(f"Seeded read-only demo account: {DEMO_ACCOUNT_EMAIL}")


if __name__ == "__main__":
    main()
