"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const commissionResultSchema = z.object({
  annual_revenue: z.string(),
  total_commission: z.string(),
  bands: z.array(
    z.object({
      tier: z.enum(["first_100m", "next_900m", "above_1b"]),
      revenue_portion: z.string(),
      rate_percent: z.string(),
      commission: z.string()
    })
  )
});

type CommissionResult = z.infer<typeof commissionResultSchema>;

export function CommissionCalculator() {
  const t = useTranslations("pricing");
  const errors = useTranslations("errors");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [result, setResult] = useState<CommissionResult>();
  const [requestError, setRequestError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  async function calculateCommission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(undefined);
    setResult(undefined);
    setIsLoading(true);

    try {
      const response = await fetch("/api/pricing/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annual_revenue: annualRevenue })
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const detail =
          typeof body === "object" &&
          body !== null &&
          "detail" in body &&
          typeof body.detail === "string"
            ? body.detail
            : "calculatorFailed";
        setRequestError(
          detail === "pricing.calculator_unavailable"
            ? "calculatorUnavailable"
            : "calculatorFailed"
        );
        return;
      }
      setResult(commissionResultSchema.parse(body));
    } catch {
      setRequestError("calculatorUnavailable");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[.9fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {t("commission.eyebrow")}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          {t("commission.title")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("commission.description")}
        </p>
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          {(["first", "second", "third"] as const).map((tier) => (
            <li className="flex items-start gap-2" key={tier}>
              <span aria-hidden="true" className="text-primary">
                •
              </span>
              {t(`commission.tiers.${tier}`)}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {t("commission.progressiveNote")}
        </p>
      </div>

      <div>
        <form className="space-y-4" onSubmit={calculateCommission}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="annual-revenue">
              {t("commission.inputLabel")}
            </label>
            <div className="relative">
              <Input
                autoComplete="off"
                id="annual-revenue"
                inputMode="decimal"
                min="0"
                pattern="[0-9]+([.][0-9]{1,2})?"
                placeholder={t("commission.placeholder")}
                required
                step="0.01"
                type="number"
                value={annualRevenue}
                onChange={(event) => setAnnualRevenue(event.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {t("commission.currency")}
              </span>
            </div>
          </div>
          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? t("commission.loading") : t("commission.calculate")}
          </Button>
        </form>

        {requestError ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {errors(requestError)}
          </p>
        ) : null}
        {result ? (
          <div aria-live="polite" className="mt-5 rounded-xl bg-muted p-5">
            <p className="text-sm text-muted-foreground">
              {t("commission.resultLabel")}
            </p>
            <p className="mt-1 text-3xl font-semibold">
              {result.total_commission}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                {t("commission.currency")}
              </span>
            </p>
            <ul className="mt-4 space-y-2 border-t border-border pt-4">
              {result.bands.map((band) => (
                <li
                  className="flex items-center justify-between gap-3 text-xs"
                  key={band.tier}
                >
                  <span className="text-muted-foreground">
                    {t(`commission.bandNames.${band.tier}`)} ·{" "}
                    {band.rate_percent}%
                  </span>
                  <span className="font-medium">
                    {band.commission} {t("commission.currency")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
