"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import type { BillingPeriod } from "@/config/pricing";
import { useRouter } from "@/i18n/navigation";

export function PlanSelectButton({
  plan,
  period
}: {
  plan: "free" | "pro" | "business";
  period: BillingPeriod;
}) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const { status } = useSession();
  const router = useRouter();
  const checkoutUrl = `/${locale}/app/billing?plan=${plan}&period=${period}`;

  return (
    <Button
      className="w-full"
      disabled={status === "loading"}
      onClick={() =>
        router.push(
          plan === "free"
            ? status === "authenticated"
              ? "/app"
              : "/signup?plan=free"
            : status === "authenticated"
              ? `/app/billing?plan=${plan}&period=${period}`
              : `/signup?plan=${plan}&callbackUrl=${encodeURIComponent(checkoutUrl)}`
        )
      }
      variant={plan === "pro" ? "default" : "outline"}
    >
      {t(
        status === "loading"
          ? "checkingSession"
          : status === "authenticated" && plan !== "free"
            ? "viewBilling"
            : "selectPlan"
      )}
    </Button>
  );
}
