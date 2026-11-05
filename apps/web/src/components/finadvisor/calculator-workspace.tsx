"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const explanationSchema = z.object({
  formula: z.string(),
  inputs: z.record(z.string())
});
const periodSchema = z.object({
  operating_days: z.number().int(),
  revenue: z.string(),
  variable_costs: z.string(),
  fixed_costs: z.string(),
  operating_profit: z.string()
});

const calculationResponseSchema = z.discriminatedUnion("calculation_type", [
  z.object({
    calculation_type: z.literal("startup-cost"),
    result: z.object({
      items: z.array(
        z.object({
          category: z.string(),
          name: z.string(),
          quantity: z.string(),
          unit_cost: z.string(),
          total_cost: z.string()
        })
      ),
      category_totals: z.record(z.string()),
      total_cost: z.string()
    }),
    explanation: explanationSchema
  }),
  z.object({
    calculation_type: z.literal("payroll"),
    result: z.object({
      employee_count: z.number().int(),
      monthly_payroll: z.string(),
      annual_payroll: z.string(),
      employer_contributions: z.array(
        z.object({
          key: z.string(),
          rate: z.string().nullable(),
          monthly_amount: z.string().nullable(),
          annual_amount: z.string().nullable(),
          source_url: z.string(),
          effective_date: z.string(),
          verified: z.boolean()
        })
      ),
      monthly_employer_contributions: z.string().nullable(),
      annual_employer_contributions: z.string().nullable(),
      monthly_total_employer_cost: z.string().nullable(),
      annual_total_employer_cost: z.string().nullable(),
      contributions_complete: z.boolean(),
      contributions_verified: z.boolean(),
      positions: z.array(
        z.object({
          role: z.string(),
          employee_count: z.number().int(),
          monthly_salary: z.string(),
          monthly_payroll: z.string()
        })
      )
    }),
    explanation: explanationSchema
  }),
  z.object({
    calculation_type: z.literal("tax-comparison"),
    result: z.object({
      annual_revenue: z.string(),
      annual_expenses: z.string(),
      pretax_profit: z.string(),
      regimes: z.array(
        z.object({
          regime: z.string(),
          taxable_base: z.string(),
          rate: z.string(),
          tax_amount: z.string(),
          profit_after_tax: z.string(),
          source_article: z.string(),
          source_name: z.string(),
          source_url: z.string(),
          effective_from: z.string(),
          published_at: z.string(),
          eligibility_note: z.string(),
          verified: z.boolean(),
          verified_by: z.string().nullable()
        })
      )
    }),
    explanation: explanationSchema
  }),
  z.object({
    calculation_type: z.literal("loan-affordability"),
    result: z.object({
      affordable: z.boolean(),
      monthly_available_cash: z.string(),
      maximum_monthly_payment: z.string(),
      minimum_monthly_surplus: z.string(),
      schedule: z.object({
        method: z.enum(["annuity", "differential"]),
        principal: z.string(),
        annual_interest_rate_percent: z.string(),
        term_months: z.number().int(),
        first_payment: z.string(),
        total_payment: z.string(),
        total_interest: z.string(),
        payments: z.array(
          z.object({
            month: z.number().int(),
            payment: z.string(),
            principal: z.string(),
            interest: z.string(),
            remaining_balance: z.string()
          })
        )
      })
    }),
    explanation: explanationSchema
  }),
  z.object({
    calculation_type: z.literal("revenue-projection"),
    result: z.object({
      daily: periodSchema,
      weekly: periodSchema,
      monthly: periodSchema,
      yearly: periodSchema,
      break_even_revenue_monthly: z.string(),
      target_revenue_monthly: z.string(),
      sensitivity: z.array(
        z.object({
          revenue_change_percent: z.string(),
          variable_cost_change_points: z.string(),
          projected_monthly_profit: z.string()
        })
      )
    }),
    explanation: explanationSchema
  })
]);

type CalculatorResult = z.infer<typeof calculationResponseSchema>;
type CalculatorPageType = "startup-cost" | "payroll" | "tax" | "loan" | "profit";
type StartupCategory =
  | "rent_deposit"
  | "renovation"
  | "kitchen_equipment"
  | "furniture"
  | "licenses"
  | "initial_stock"
  | "marketing"
  | "reserve";
type PayrollPosition = {
  role: string;
  employee_count: string;
  monthly_salary: string;
};
type SavedPlan = { id: string; business_name: string; location: string };

const categories: StartupCategory[] = [
  "rent_deposit",
  "renovation",
  "kitchen_equipment",
  "furniture",
  "licenses",
  "initial_stock",
  "marketing",
  "reserve"
];

function resultCalculationType(type: CalculatorPageType) {
  switch (type) {
    case "startup-cost":
      return "startup-cost";
    case "payroll":
      return "payroll";
    case "tax":
      return "tax-comparison";
    case "loan":
      return "loan-affordability";
    case "profit":
      return "revenue-projection";
  }
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ResultChart({
  label,
  rows
}: {
  label: string;
  rows: Array<{ label: string; value: string }>;
}) {
  const magnitudes = rows.map((row) => {
    const value = Number(row.value);
    return Number.isFinite(value) ? Math.abs(value) : 0;
  });
  const maximum = Math.max(1, ...magnitudes);

  return (
    <div aria-label={label} className="space-y-3" role="img">
      {rows.map((row, index) => {
        const magnitude = magnitudes[index];
        const width = magnitude === 0 ? 0 : (magnitude / maximum) * 100;
        return (
          <div className="grid gap-1 sm:grid-cols-[minmax(8rem,1fr)_2fr_auto] sm:items-center sm:gap-3" key={`${row.label}-${index}`}>
            <span className="text-sm">{row.label}</span>
            <span aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="text-sm tabular-nums">{row.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  id,
  label,
  children
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function CalculatorWorkspace({
  calculatorType
}: {
  calculatorType: CalculatorPageType;
}) {
  const t = useTranslations("routeCopy.calculator");
  const errors = useTranslations("routeCopy.calculator.errors");
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;
  const isBusinessOwner = session?.user?.role === "tadbirkor";

  const [category, setCategory] = useState<StartupCategory>("rent_deposit");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [positions, setPositions] = useState<PayrollPosition[]>([
    { role: "", employee_count: "", monthly_salary: "" }
  ]);
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [annualExpenses, setAnnualExpenses] = useState("");
  const [method, setMethod] = useState<"annuity" | "differential">("annuity");
  const [principal, setPrincipal] = useState("");
  const [annualRate, setAnnualRate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [monthlyAvailableCash, setMonthlyAvailableCash] = useState("");
  const [dailyRevenue, setDailyRevenue] = useState("");
  const [monthlyFixedCosts, setMonthlyFixedCosts] = useState("");
  const [variableCostPercent, setVariableCostPercent] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [daysPerMonth, setDaysPerMonth] = useState("");
  const [daysPerYear, setDaysPerYear] = useState("");
  const [targetProfit, setTargetProfit] = useState("");

  const [result, setResult] = useState<CalculatorResult>();
  const [lastInputs, setLastInputs] = useState<Record<string, unknown>>();
  const [requestError, setRequestError] = useState<string>();
  const [isCalculating, setIsCalculating] = useState(false);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  useEffect(() => {
    if (!accessToken || !isBusinessOwner) {
      setPlans([]);
      setSelectedPlanId("");
      setPlansLoading(false);
      return;
    }

    let cancelled = false;
    async function loadPlans() {
      setPlansLoading(true);
      setPlansError(false);
      try {
        const response = await fetch("/api/plans/mine", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store"
        });
        const body: unknown = await response.json();
        const parsed = z.object({
          items: z.array(
            z.object({
              id: z.string(),
              business_name: z.string(),
              location: z.string()
            })
          )
        }).safeParse(body);
        if (!response.ok || !parsed.success) throw new Error("plansLoadFailed");
        if (!cancelled) {
          setPlans(parsed.data.items);
          setSelectedPlanId((current) => current || parsed.data.items[0]?.id || "");
        }
      } catch {
        if (!cancelled) setPlansError(true);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    }

    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isBusinessOwner]);

  function buildInputs(): Record<string, unknown> {
    switch (calculatorType) {
      case "startup-cost":
        return {
          items: [
            {
              category,
              name: itemName,
              quantity,
              unit_cost: unitCost
            }
          ]
        };
      case "payroll":
        return {
          positions: positions.map((position) => ({
            role: position.role,
            employee_count: Number(position.employee_count),
            monthly_salary: position.monthly_salary
          }))
        };
      case "tax":
        return {
          annual_revenue: annualRevenue,
          annual_expenses: annualExpenses
        };
      case "loan":
        return {
          method,
          monthly_available_cash: monthlyAvailableCash,
          principal,
          annual_interest_rate_percent: annualRate,
          term_months: Number(termMonths)
        };
      case "profit":
        return {
          daily_revenue: dailyRevenue,
          monthly_fixed_costs: monthlyFixedCosts,
          variable_cost_ratio_percent: variableCostPercent,
          operating_days_per_week: Number(daysPerWeek),
          operating_days_per_month: Number(daysPerMonth),
          operating_days_per_year: Number(daysPerYear),
          target_monthly_profit: targetProfit,
          revenue_sensitivity_percentages: [],
          variable_cost_sensitivity_points: []
        };
    }
  }

  async function submitCalculation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(undefined);
    setLastInputs(undefined);
    setRequestError(undefined);
    setSaveSucceeded(false);
    setSaveError(undefined);
    setIsCalculating(true);
    const inputs = buildInputs();

    try {
      const response = await fetch(
        `/api/calc/${resultCalculationType(calculatorType)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify(inputs)
        }
      );
      if (!response.ok) {
        setRequestError("calculationFailed");
        return;
      }
      const parsed = calculationResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setRequestError("calculationFailed");
        return;
      }
      setResult(parsed.data);
      setLastInputs(inputs);
    } catch (error) {
      setRequestError(
        error instanceof TypeError ? "serviceUnavailable" : "calculationFailed"
      );
    } finally {
      setIsCalculating(false);
    }
  }

  async function saveResultToPlan() {
    if (!accessToken || !selectedPlanId || !result || !lastInputs) return;
    setIsSaving(true);
    setSaveError(undefined);
    setSaveSucceeded(false);
    try {
      const response = await fetch(
        `/api/plans/${encodeURIComponent(selectedPlanId)}/calculations`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            calculation_type: result.calculation_type,
            inputs: lastInputs
          })
        }
      );
      if (!response.ok) {
        setSaveError("planSaveFailed");
        return;
      }
      setSaveSucceeded(true);
    } catch {
      setSaveError("planSaveFailed");
    } finally {
      setIsSaving(false);
    }
  }

  function updatePosition(
    index: number,
    field: keyof PayrollPosition,
    value: string
  ) {
    setPositions((current) =>
      current.map((position, positionIndex) =>
        positionIndex === index
          ? { ...position, [field]: value }
          : position
      )
    );
  }

  const numberInput = (
    id: string,
    value: string,
    onChange: (value: string) => void,
    options: { min?: string; max?: string; step?: string } = {}
  ) => (
    <Input
      id={id}
      max={options.max}
      min={options.min}
      onChange={(event) => onChange(event.target.value)}
      required
      step={options.step ?? "0.01"}
      type="number"
      value={value}
    />
  );

  function renderFormFields() {
    if (calculatorType === "startup-cost") {
      return (
        <>
          <FormField id="calculator-category" label={t("fields.category")}>
            <Select
              id="calculator-category"
              onChange={(event) => setCategory(event.target.value as StartupCategory)}
              value={category}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {t(`categories.${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="calculator-item-name" label={t("fields.name")}>
            <Input
              id="calculator-item-name"
              maxLength={200}
              onChange={(event) => setItemName(event.target.value)}
              required
              value={itemName}
            />
          </FormField>
          <FormField id="calculator-quantity" label={t("fields.quantity")}>
            {numberInput("calculator-quantity", quantity, setQuantity, { min: "0" })}
          </FormField>
          <FormField id="calculator-unit-cost" label={t("fields.unitCost")}>
            {numberInput("calculator-unit-cost", unitCost, setUnitCost, { min: "0" })}
          </FormField>
        </>
      );
    }
    if (calculatorType === "payroll") {
      return (
        <div className="space-y-4 sm:col-span-2">
          {positions.map((position, index) => (
            <Card className="grid gap-4 p-4 sm:grid-cols-3" key={`position-${index}`}>
              <FormField
                id={`calculator-role-${index}`}
                label={t("fields.role")}
              >
                <Input
                  id={`calculator-role-${index}`}
                  maxLength={200}
                  onChange={(event) => updatePosition(index, "role", event.target.value)}
                  required
                  value={position.role}
                />
              </FormField>
              <FormField
                id={`calculator-employees-${index}`}
                label={t("fields.employeeCount")}
              >
                {numberInput(
                  `calculator-employees-${index}`,
                  position.employee_count,
                  (value) => updatePosition(index, "employee_count", value),
                  { min: "0", step: "1" }
                )}
              </FormField>
              <FormField
                id={`calculator-salary-${index}`}
                label={t("fields.monthlySalary")}
              >
                {numberInput(
                  `calculator-salary-${index}`,
                  position.monthly_salary,
                  (value) => updatePosition(index, "monthly_salary", value),
                  { min: "0" }
                )}
              </FormField>
              {positions.length > 1 ? (
                <Button
                  className="sm:col-span-3 sm:justify-self-end"
                  onClick={() =>
                    setPositions((current) =>
                      current.filter((_, positionIndex) => positionIndex !== index)
                    )
                  }
                  type="button"
                  variant="outline"
                >
                  {t("removePosition")}
                </Button>
              ) : null}
            </Card>
          ))}
          <Button
            onClick={() =>
              setPositions((current) => [
                ...current,
                { role: "", employee_count: "", monthly_salary: "" }
              ])
            }
            type="button"
            variant="outline"
          >
            {t("addPosition")}
          </Button>
        </div>
      );
    }
    if (calculatorType === "tax") {
      return (
        <>
          <FormField id="calculator-annual-revenue" label={t("fields.annualRevenue")}>
            {numberInput("calculator-annual-revenue", annualRevenue, setAnnualRevenue, { min: "0" })}
          </FormField>
          <FormField id="calculator-annual-expenses" label={t("fields.annualExpenses")}>
            {numberInput("calculator-annual-expenses", annualExpenses, setAnnualExpenses, { min: "0" })}
          </FormField>
        </>
      );
    }
    if (calculatorType === "loan") {
      return (
        <>
          <FormField id="calculator-principal" label={t("fields.principal")}>
            {numberInput("calculator-principal", principal, setPrincipal, { min: "0" })}
          </FormField>
          <FormField id="calculator-rate" label={t("fields.annualRate")}>
            {numberInput("calculator-rate", annualRate, setAnnualRate, { min: "0" })}
          </FormField>
          <FormField id="calculator-term" label={t("fields.term")}>
            {numberInput("calculator-term", termMonths, setTermMonths, { min: "1", max: "600", step: "1" })}
          </FormField>
          <FormField id="calculator-cash" label={t("fields.availableCash")}>
            {numberInput("calculator-cash", monthlyAvailableCash, setMonthlyAvailableCash, { min: "0" })}
          </FormField>
          <FormField id="calculator-method" label={t("fields.method")}>
            <Select
              id="calculator-method"
              onChange={(event) => setMethod(event.target.value as "annuity" | "differential")}
              value={method}
            >
              <option value="annuity">{t("methods.annuity")}</option>
              <option value="differential">{t("methods.differential")}</option>
            </Select>
          </FormField>
        </>
      );
    }
    return (
      <>
        <FormField id="calculator-daily-revenue" label={t("fields.dailyRevenue")}>
          {numberInput("calculator-daily-revenue", dailyRevenue, setDailyRevenue, { min: "0" })}
        </FormField>
        <FormField id="calculator-fixed-costs" label={t("fields.monthlyFixedCosts")}>
          {numberInput("calculator-fixed-costs", monthlyFixedCosts, setMonthlyFixedCosts, { min: "0" })}
        </FormField>
        <FormField id="calculator-variable-cost" label={t("fields.variableCosts")}>
          {numberInput("calculator-variable-cost", variableCostPercent, setVariableCostPercent, { min: "0", max: "99.99" })}
        </FormField>
        <FormField id="calculator-days-week" label={t("fields.operatingDaysPerWeek")}>
          {numberInput("calculator-days-week", daysPerWeek, setDaysPerWeek, { min: "1", max: "7", step: "1" })}
        </FormField>
        <FormField id="calculator-days-month" label={t("fields.operatingDaysPerMonth")}>
          {numberInput("calculator-days-month", daysPerMonth, setDaysPerMonth, { min: "1", max: "31", step: "1" })}
        </FormField>
        <FormField id="calculator-days-year" label={t("fields.operatingDaysPerYear")}>
          {numberInput("calculator-days-year", daysPerYear, setDaysPerYear, { min: "1", max: "366", step: "1" })}
        </FormField>
        <FormField id="calculator-target-profit" label={t("fields.targetProfit")}>
          {numberInput("calculator-target-profit", targetProfit, setTargetProfit)}
        </FormField>
      </>
    );
  }

  function renderResult() {
    if (!result) return null;
    const resultLabel = (key: string) => t(`results.${key}`);

    return (
      <Card className="mt-6 space-y-5 p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-semibold">{resultLabel("result")}</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {resultLabel("formula")}: {result.explanation.formula}
          </p>
        </div>
        {result.calculation_type === "startup-cost" ? (
          <>
            <ResultTile
              label={resultLabel("totalStartupCost")}
              value={result.result.total_cost}
            />
            <ResultChart
              label={resultLabel("chart")}
              rows={Object.entries(result.result.category_totals).map(([key, value]) => ({
                label: t(`categories.${key}`),
                value
              }))}
            />
          </>
        ) : null}
        {result.calculation_type === "payroll" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile
                label={resultLabel("monthlyPayroll")}
                value={result.result.monthly_payroll}
              />
              <ResultTile
                label={resultLabel("annualPayroll")}
                value={result.result.annual_payroll}
              />
            </div>
            {result.result.contributions_complete ? (
              <>
                <ResultTile
                  label={resultLabel("monthlyEmployerCost")}
                  value={result.result.monthly_total_employer_cost ?? ""}
                />
                <p className="text-sm text-muted-foreground">
                  {result.result.contributions_verified
                    ? t("verified")
                    : `${t("estimate")}: ${t("unverified")}`}
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-border bg-muted p-4 text-sm">
                {t("contributionUnavailable")}
              </p>
            )}
            <ResultChart
              label={resultLabel("chart")}
              rows={result.result.positions.map((position) => ({
                label: position.role,
                value: position.monthly_payroll
              }))}
            />
          </>
        ) : null}
        {result.calculation_type === "tax-comparison" ? (
          <div className="space-y-4">
            {result.result.regimes.map((regime) => (
              <Card className="space-y-3 p-4" key={regime.regime}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{regime.regime}</h3>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                    {regime.verified ? t("verified") : `${t("estimate")}: ${t("unverified")}`}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResultTile label={resultLabel("taxAmount")} value={regime.tax_amount} />
                  <ResultTile label={resultLabel("profitAfterTax")} value={regime.profit_after_tax} />
                  <ResultTile label={resultLabel("taxableBase")} value={regime.taxable_base} />
                  <ResultTile label={t("fields.variableCosts")} value={`${regime.rate}%`} />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {regime.source_name} · {regime.source_article} ·{" "}
                  <a className="underline underline-offset-4 hover:text-primary" href={regime.source_url} rel="noreferrer" target="_blank">
                    {regime.source_url}
                  </a>
                </p>
                <p className="text-xs text-muted-foreground">{regime.eligibility_note}</p>
              </Card>
            ))}
            <ResultChart
              label={resultLabel("chart")}
              rows={result.result.regimes.map((regime) => ({
                label: regime.regime,
                value: regime.tax_amount
              }))}
            />
          </div>
        ) : null}
        {result.calculation_type === "loan-affordability" ? (
          <>
            <p className="rounded-xl border border-border bg-muted p-4 text-sm font-medium">
              {result.result.affordable ? t("loanAffordable") : t("loanNotAffordable")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile
                label={resultLabel("maximumPayment")}
                value={result.result.maximum_monthly_payment}
              />
              <ResultTile
                label={resultLabel("availableCash")}
                value={result.result.monthly_available_cash}
              />
              <ResultTile
                label={resultLabel("paymentSurplus")}
                value={result.result.minimum_monthly_surplus}
              />
              <ResultTile
                label={resultLabel("totalPayment")}
                value={result.result.schedule.total_payment}
              />
              <ResultTile
                label={resultLabel("totalInterest")}
                value={result.result.schedule.total_interest}
              />
            </div>
            <ResultChart
              label={resultLabel("chart")}
              rows={result.result.schedule.payments.slice(0, 12).map((payment) => ({
                label: `${resultLabel("month")} ${payment.month}`,
                value: payment.payment
              }))}
            />
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {resultLabel("schedule")}
              </summary>
              <div className="mt-4 max-h-80 overflow-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr>
                      {[
                        resultLabel("month"),
                        resultLabel("payment"),
                        resultLabel("principalPaid"),
                        resultLabel("interest"),
                        resultLabel("remainingBalance")
                      ].map((heading) => (
                        <th className="border-b border-border p-2 font-medium" key={heading}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.result.schedule.payments.map((payment) => (
                      <tr key={payment.month}>
                        <td className="border-b border-border p-2">{payment.month}</td>
                        <td className="border-b border-border p-2 tabular-nums">{payment.payment}</td>
                        <td className="border-b border-border p-2 tabular-nums">{payment.principal}</td>
                        <td className="border-b border-border p-2 tabular-nums">{payment.interest}</td>
                        <td className="border-b border-border p-2 tabular-nums">{payment.remaining_balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : null}
        {result.calculation_type === "revenue-projection" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((period) => (
                <ResultTile
                  key={period}
                  label={`${t(`periods.${period}`)} · ${resultLabel("revenue")}`}
                  value={result.result[period].revenue}
                />
              ))}
              <ResultTile
                label={resultLabel("monthlyProfit")}
                value={result.result.monthly.operating_profit}
              />
              <ResultTile
                label={resultLabel("breakEvenRevenue")}
                value={result.result.break_even_revenue_monthly}
              />
              <ResultTile
                label={resultLabel("targetRevenue")}
                value={result.result.target_revenue_monthly}
              />
            </div>
            <ResultChart
              label={resultLabel("chart")}
              rows={(["daily", "weekly", "monthly", "yearly"] as const).map((period) => ({
                label: `${t(`periods.${period}`)} · ${resultLabel("revenue")}`,
                value: result.result[period].revenue
              }))}
            />
          </>
        ) : null}
      </Card>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/${locale}/calculators`}
      >
        {t("backToCalculators")}
      </Link>
      <header className="mt-5 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {t("title")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t(`labels.${calculatorType}`)}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t(`descriptions.${calculatorType}`)}
        </p>
      </header>

      <Card className="mt-7 p-5 sm:p-8">
        <form className="grid gap-5 sm:grid-cols-2" onSubmit={submitCalculation}>
          {renderFormFields()}
          <Button
            className="sm:col-span-2 sm:justify-self-start"
            disabled={isCalculating}
            loading={isCalculating}
            type="submit"
          >
            {isCalculating ? t("loading") : t("calculate")}
          </Button>
        </form>
        {requestError ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {errors(requestError)}
          </p>
        ) : null}
      </Card>

      {renderResult()}

      {result ? (
        <Card className="mt-5 space-y-4 p-5 sm:p-7">
          <h2 className="text-lg font-semibold">{t("saveToPlan")}</h2>
          {sessionStatus === "loading" || plansLoading ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {t("plansLoading")}
            </p>
          ) : null}
          {sessionStatus !== "loading" && !isBusinessOwner ? (
            <p className="text-sm text-muted-foreground">{t("signInRequired")}</p>
          ) : null}
          {plansError ? (
            <p className="text-sm text-destructive" role="alert">
              {errors("plansLoadFailed")}
            </p>
          ) : null}
          {isBusinessOwner && !plansLoading && !plansError && plans.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("noPlans")}</p>
              <Button asChild variant="outline">
                <Link href={`/${locale}/app/finadvisor`}>{t("createPlan")}</Link>
              </Button>
            </div>
          ) : null}
          {isBusinessOwner && plans.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <FormField id="calculator-plan" label={t("selectPlan")}>
                <Select
                  id="calculator-plan"
                  onChange={(event) => {
                    setSelectedPlanId(event.target.value);
                    setSaveSucceeded(false);
                  }}
                  value={selectedPlanId}
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.business_name} · {plan.location}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Button
                disabled={!selectedPlanId || isSaving}
                loading={isSaving}
                onClick={saveResultToPlan}
                type="button"
              >
                {isSaving ? t("saveLoading") : t("saveToPlan")}
              </Button>
            </div>
          ) : null}
          {saveSucceeded ? (
            <p aria-live="polite" className="text-sm text-success">
              {t("planSaved")}
            </p>
          ) : null}
          {saveError ? (
            <p className="text-sm text-destructive" role="alert">
              {errors(saveError)}
            </p>
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}
