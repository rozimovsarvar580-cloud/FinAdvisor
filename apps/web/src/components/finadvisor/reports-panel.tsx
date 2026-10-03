"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

import { type PlanResult } from "@/components/finadvisor/plan-wizard";

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

export function ReportsPanel({ planResult }: { planResult?: PlanResult }) {
  const t = useTranslations("finadvisor.reports");

  if (!planResult) {
    return (
      <EmptyState
        description={t("emptyDescription")}
        title={t("emptyTitle")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {t("eyebrow")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{t("title")}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {planResult.summary}
        </p>
      </Card>
      <Card className="p-5 sm:p-8">
        <h3 className="text-lg font-semibold">{t("calculationsTitle")}</h3>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {calculationKeys.map((key) => {
            const value = planResult.calculations[key];
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
      <Card className="p-5 sm:p-8">
        <h3 className="text-lg font-semibold">{t("sectionsTitle")}</h3>
        <div className="mt-5 space-y-5">
          {planResult.sections.map((section, index) => (
            <article className="border-t border-border pt-5 first:border-0 first:pt-0" key={`${section.title}-${index}`}>
              <h4 className="font-semibold">{section.title}</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {section.content}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <Button disabled type="button" variant="outline">
            {t("exportSoon")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
