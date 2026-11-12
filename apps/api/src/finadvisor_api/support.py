from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from finadvisor_api.email_sender import EmailDeliveryError, send_support_contact_email

router = APIRouter(prefix="/support", tags=["support"])


class SupportContactRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    email: EmailStr = Field(max_length=320)
    category: Literal["general", "technical", "billing", "feedback"]
    message: str = Field(min_length=10, max_length=4000)
    consent: Literal[True]
    locale: Literal["uz", "ru", "en"]


@router.post("/contact", status_code=status.HTTP_202_ACCEPTED)
def send_support_contact(payload: SupportContactRequest) -> dict[str, bool]:
    try:
        send_support_contact_email(
            locale=payload.locale,
            name=payload.name,
            email=str(payload.email),
            category=payload.category,
            message_body=payload.message,
        )
    except EmailDeliveryError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="support.email_delivery_unavailable",
        ) from error
    return {"sent": True}
