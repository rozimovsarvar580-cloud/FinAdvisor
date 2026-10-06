from fastapi import APIRouter

from finance_engine.capex import CapexInput, calculate_capex
from finance_engine.credit import CreditInput, ReverseCreditInput, annuity_schedule, reverse_annuity
from finance_engine.metrics import BreakEvenInput, calculate_break_even
from finance_engine.revenue_profit import RevenueProfitInput, calculate_revenue_profit

from ..schemas import CalculationResponse, CreditCalculationRequest

router = APIRouter(prefix="/calc", tags=["calculations"])


@router.post("/credit/annuity", response_model=CalculationResponse)
async def calculate_annuity(request: CreditCalculationRequest) -> CalculationResponse:
    inputs = request.model_dump(mode="json")
    rows = annuity_schedule(CreditInput(**request.model_dump()))
    return CalculationResponse(
        calculation="annuity_credit",
        rows=[row.model_dump(mode="json") for row in rows],
        formula="payment = principal * r * (1 + r)^n / ((1 + r)^n - 1)",
        inputs=inputs,
    )


@router.post("/capex", response_model=CalculationResponse)
async def calculate_capex_plan(request: CapexInput) -> CalculationResponse:
    result = calculate_capex(request)
    return CalculationResponse(
        calculation="capex",
        rows=[result.model_dump(mode="json")],
        formula=result.formula,
        inputs=request.model_dump(mode="json"),
    )


@router.post("/revenue-profit", response_model=CalculationResponse)
async def calculate_revenue_and_profit(request: RevenueProfitInput) -> CalculationResponse:
    result = calculate_revenue_profit(request)
    return CalculationResponse(
        calculation="revenue_profit",
        rows=[result.model_dump(mode="json")],
        formula=result.formula,
        inputs=request.model_dump(mode="json"),
    )


@router.post("/break-even", response_model=CalculationResponse)
async def calculate_break_even_point(request: BreakEvenInput) -> CalculationResponse:
    result = calculate_break_even(request)
    return CalculationResponse(
        calculation="break_even",
        rows=[result.model_dump(mode="json")],
        formula=result.formula,
        inputs=request.model_dump(mode="json"),
    )


@router.post("/credit/reverse", response_model=CalculationResponse)
async def calculate_reverse_credit(request: ReverseCreditInput) -> CalculationResponse:
    result = reverse_annuity(request)
    return CalculationResponse(
        calculation="reverse_annuity_credit",
        rows=[result.model_dump(mode="json")],
        formula=result.formula,
        inputs=request.model_dump(mode="json"),
    )
