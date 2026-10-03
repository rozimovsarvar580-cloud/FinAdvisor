"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const explanationSchema = z.object({
  formula: z.string(),
  inputs: z.record(z.string())
});

const calculationResponseSchema = z.discriminatedUnion("calculation_type", [
  z.object({
    calculation_type: z.literal("break-even"),
    result: z.object({
      break_even_revenue: z.string(),
      contribution_margin_ratio: z.string()
    }),
    explanation: explanationSchema
  }),
  z.object({
    calculation_type: z.literal("dscr"),
    result: z.object({ dscr: z.string() }),
    explanation: explanationSchema
  })
]);

type CalculatorKind = "breakEven" | "dscr";

export function CalculatorsPanel() {
  const t = useTranslations("finadvisor.calculators");
  const errors = useTranslations("errors");
  const [kind, setKind] = useState<CalculatorKind>("breakEven");
  const [fixedCosts, setFixedCosts] = useState("");
  const [variablePercent, setVariablePercent] = useState("");
  const [operatingCashFlow, setOperatingCashFlow] = useState("");
  const [debtService, setDebtService] = useState("");
  const [result, setResult] = useState<z.infer<typeof calculationResponseSchema>>();
  const [requestError, setRequestError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  async function submitCalculation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(undefined);
    setRequestError(undefined);
    setIsLoading(true);
    const calculationType = kind === "breakEven" ? "break-even" : "dscr";
    const payload =
      kind === "breakEven"
        ? {
            fixed_costs: fixedCosts,
            variable_cost_ratio_percent: variablePercent
          }
        : {
            annual_operating_cash_flow: operatingCashFlow,
            annual_debt_service: debtService
          };

    try {
      const response = await fetch(`/api/calc/${calculationType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setRequestError("calculationFailed");
        return;
      }
      setResult(calculationResponseSchema.parse(await response.json()));
    } catch (error) {
      setRequestError(
        error instanceof TypeError ? "calculatorUnavailable" : "calculationFailed"
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
      <div className="mt-6 flex flex-wrap gap-2">
        {(["breakEven", "dscr"] as const).map((calculator) => (
          <Button
            aria-pressed={kind === calculator}
            key={calculator}
            onClick={() => {
              setKind(calculator);
              setResult(undefined);
            }}
            type="button"
            variant={kind === calculator ? "default" : "outline"}
          >
            {t(`types.${calculator}`)}
          </Button>
        ))}
      </div>
      <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={submitCalculation}>
        {kind === "breakEven" ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="calculator-fixed-costs">
                {t("fixedCosts")}
              </label>
              <Input
                id="calculator-fixed-costs"
                min="0"
                required
                step="0.01"
                type="number"
                value={fixedCosts}
                onChange={(event) => setFixedCosts(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="calculator-variable-cost">
                {t("variableCostPercent")}
              </label>
              <Input
                id="calculator-variable-cost"
                max="99.99"
                min="0"
                required
                step="0.01"
                type="number"
                value={variablePercent}
                onChange={(event) => setVariablePercent(event.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="calculator-cash-flow">
                {t("annualCashFlow")}
              </label>
              <Input
                id="calculator-cash-flow"
                required
                step="0.01"
                type="number"
                value={operatingCashFlow}
                onChange={(event) => setOperatingCashFlow(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="calculator-debt-service">
                {t("annualDebtService")}
              </label>
              <Input
                id="calculator-debt-service"
                min="0.01"
                required
                step="0.01"
                type="number"
                value={debtService}
                onChange={(event) => setDebtService(event.target.value)}
              />
            </div>
          </>
        )}
        <Button className="sm:col-span-2" disabled={isLoading} type="submit">
          {isLoading ? t("loading") : t("calculate")}
        </Button>
      </form>

      {requestError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errors(requestError)}
        </p>
      ) : null}
      {result ? (
        <div aria-live="polite" className="mt-6 rounded-xl bg-muted p-5">
          <p className="text-sm font-semibold">{t("result")}</p>
          <p className="mt-2 text-2xl font-semibold">
            {            result.calculation_type === "break-even"
              ? result.result.break_even_revenue
              : result.result.dscr}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {t("formula")}: {result.explanation.formula}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
