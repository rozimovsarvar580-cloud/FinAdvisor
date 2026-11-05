"use client";

import { useTranslations } from "next-intl";

export type TaxRuleProvenance = {
  key: "turnover_tax" | "profit_tax";
  rate: string | null;
  source_url: string;
  effective_date: string;
  verified: boolean;
  verified_by: string | null;
};

export function TaxRuleProvenanceList({
  sourceName,
  rules
}: {
  sourceName: string;
  rules: TaxRuleProvenance[];
}) {
  const t = useTranslations("routeCopy.accounting");

  return (
    <div className="mt-6 space-y-4">
      {rules.map((rule) => (
        <article
          className="rounded-xl border border-border bg-card p-5 text-card-foreground"
          key={rule.key}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {t(`taxRuleNames.${rule.key}`)}
            </h2>
            <span
              className={
                rule.verified
                  ? "rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                  : "rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground"
              }
              data-testid="tax-rule-status"
            >
              {rule.verified ? t("verified") : t("estimate")}
            </span>
          </div>
          {rule.rate !== null ? (
            <p className="mt-3 text-sm">{t("rate", { rate: rule.rate })}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {t("source")}:{" "}
            <a
              className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={rule.source_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {sourceName}
            </a>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("effectiveDate", { date: rule.effective_date })}
          </p>
          {rule.verified && rule.verified_by ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("verifiedBy", { name: rule.verified_by })}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
