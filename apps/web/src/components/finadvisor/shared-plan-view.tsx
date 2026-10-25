"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";

import { Card } from "@/components/ui/card";
import { planResultSchema } from "@/components/finadvisor/plan-wizard";

const sharedPlanSchema = z.object({
  plan_id: z.string().min(1),
  business_name: z.string(),
  location: z.string(),
  created_at: z.string(),
  plan: planResultSchema.omit({ plan_id: true, version: true })
});

const calculationKeys = [
  "monthly_revenue",
  "monthly_payroll",
  "startup_capex",
  "total_startup_cost",
  "monthly_fixed_costs",
  "monthly_variable_cost",
  "monthly_operating_profit",
  "annual_operating_profit",
  "break_even_revenue",
  "target_monthly_revenue",
  "loan_first_payment",
  "loan_total_payment",
  "loan_total_interest",
  "annual_debt_service",
  "dscr"
] as const;

export function SharedPlanView({ token }: { token: string }) {
  const t = useTranslations("finadvisor.reports");
  const locale = useLocale();
  const [plan, setPlan] = useState<z.infer<typeof sharedPlanSchema>>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSharedPlan() {
      try {
        const response = await fetch(
          `/api/shared/${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          if (active) {
            setError(
              response.status === 404
                ? "sharedPlanNotFound"
                : response.status === 503
                  ? "sharedPlanUnavailable"
                  : "sharedPlanFailed"
            );
          }
          return;
        }
        const parsed = sharedPlanSchema.parse(await response.json());
        if (active) {
          setPlan(parsed);
        }
      } catch (caught) {
        if (!active) {
          return;
        }
        if (caught instanceof TypeError) {
          setError("sharedPlanUnavailable");
        } else if (caught instanceof SyntaxError || caught instanceof z.ZodError) {
          setError("sharedPlanFailed");
        } else {
          throw caught;
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSharedPlan();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main aria-busy="true" className="mx-auto min-h-screen max-w-4xl px-page py-10">
        <Card className="p-6 sm:p-8">
          <p className="text-sm text-muted-foreground" role="status">
            {t("sharedPlanLoading")}
          </p>
        </Card>
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-page py-10">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">{t("sharedPlanTitle")}</h1>
          <p className="mt-3 text-sm text-destructive" role="alert">
            {t(error ?? "sharedPlanFailed")}
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-5 px-page py-10">
      <Card className="p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {t("sharedPlanReadOnly")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{plan.business_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {plan.location} ·{" "}
          {t("sharedPlanCreated", {
            date: new Date(plan.created_at).toLocaleString(locale)
          })}
        </p>
        <h2 className="mt-6 text-xl font-semibold">{t("summaryLabel")}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {plan.plan.summary}
        </p>
      </Card>
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{t("sectionsTitle")}</h2>
        <div className="mt-5 space-y-5">
          {plan.plan.sections.map((section, index) => (
            <article
              className="border-t border-border pt-5 first:border-0 first:pt-0"
              key={`${section.title}-${index}`}
            >
              <h3 className="font-semibold">{section.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {section.content}
              </p>
            </article>
          ))}
        </div>
      </Card>
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{t("calculationsTitle")}</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {calculationKeys.map((key) => {
            const value = plan.plan.calculations[key];
            if (value === null || value === undefined) {
              return null;
            }
            return (
              <div className="rounded-xl bg-muted/50 p-4" key={key}>
                <dt className="text-sm text-muted-foreground">
                  {t(`calculations.${key}`)}
                </dt>
                <dd className="mt-1 break-all font-semibold">
                  {value}
                  {key === "dscr" ? "" : ` ${t("currency")}`}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>
    </main>
  );
}
