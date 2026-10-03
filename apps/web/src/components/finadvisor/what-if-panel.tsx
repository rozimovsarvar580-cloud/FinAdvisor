"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const reverseRevenueSchema = z.object({
  calculation_type: z.literal("reverse-revenue"),
  result: z.object({
    required_revenue: z.string(),
    contribution_margin_ratio: z.string()
  }),
  explanation: z.object({
    formula: z.string(),
    inputs: z.record(z.string())
  })
});

export function WhatIfPanel() {
  const t = useTranslations("finadvisor.whatIf");
  const errors = useTranslations("errors");
  const [targetProfit, setTargetProfit] = useState("");
  const [fixedCosts, setFixedCosts] = useState("");
  const [variablePercent, setVariablePercent] = useState("");
  const [result, setResult] = useState<z.infer<typeof reverseRevenueSchema>>();
  const [requestError, setRequestError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  async function submitScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(undefined);
    setRequestError(undefined);
    setIsLoading(true);
    try {
      const response = await fetch("/api/calc/reverse-revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_profit: targetProfit,
          fixed_costs: fixedCosts,
          variable_cost_ratio_percent: variablePercent
        })
      });
      if (!response.ok) {
        setRequestError("scenarioFailed");
        return;
      }
      setResult(reverseRevenueSchema.parse(await response.json()));
    } catch (error) {
      setRequestError(
        error instanceof TypeError ? "calculatorUnavailable" : "scenarioFailed"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="p-5 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 text-2xl font-semibold">{t("title")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {t("description")}
      </p>
      <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={submitScenario}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="scenario-profit">
            {t("targetProfit")}
          </label>
          <Input
            id="scenario-profit"
            required
            step="0.01"
            type="number"
            value={targetProfit}
            onChange={(event) => setTargetProfit(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="scenario-fixed-costs">
            {t("fixedCosts")}
          </label>
          <Input
            id="scenario-fixed-costs"
            min="0"
            required
            step="0.01"
            type="number"
            value={fixedCosts}
            onChange={(event) => setFixedCosts(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="scenario-variable-cost">
            {t("variableCostPercent")}
          </label>
          <Input
            id="scenario-variable-cost"
            max="99.99"
            min="0"
            required
            step="0.01"
            type="number"
            value={variablePercent}
            onChange={(event) => setVariablePercent(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? t("loading") : t("run")}
          </Button>
        </div>
      </form>
      {requestError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errors(requestError)}
        </p>
      ) : null}
      {result ? (
        <div aria-live="polite" className="mt-6 rounded-xl bg-muted p-5">
          <p className="text-sm font-semibold">{t("requiredRevenue")}</p>
          <p className="mt-2 text-2xl font-semibold">
            {result.result.required_revenue}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {t("formula")}: {result.explanation.formula}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
