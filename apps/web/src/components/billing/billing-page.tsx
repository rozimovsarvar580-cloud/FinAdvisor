"use client";

import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { pricingPlans } from "@/config/pricing";
import { mockBillingProvider } from "@/lib/billing";

export function BillingPage() {
  const t = useTranslations("billing");
  const subscription = mockBillingProvider.getSubscription();
  const plan = pricingPlans.find((item) => item.id === subscription.planId);

  if (!plan) {
    throw new Error(`Unknown subscription plan: ${subscription.planId}`);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl px-page py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <Card className="mt-7 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("currentPlan")}</p>
            <h2 className="mt-1 text-2xl font-semibold">{t(`plans.${plan.id}`)}</h2>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {t(`status.${subscription.status}`)}
          </span>
        </div>
        <dl className="mt-7 grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t("billingPeriod")}</dt>
            <dd className="mt-1 font-medium">
              {t(`periods.${subscription.billingPeriod}`)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("price")}</dt>
            <dd className="mt-1 font-medium">
              {plan.priceByPeriod[subscription.billingPeriod]}
            </dd>
          </div>
        </dl>
        <p className="mt-6 rounded-lg bg-muted p-4 text-sm leading-6 text-muted-foreground">
          {t("mockNotice")}
        </p>
        <button
          className="mt-5 h-10 cursor-not-allowed rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground disabled:opacity-60"
          disabled
          type="button"
        >
          {t("manageUnavailable")}
        </button>
      </Card>
    </main>
  );
}
