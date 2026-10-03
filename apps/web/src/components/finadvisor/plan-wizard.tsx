"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const planCalculationsSchema = z.object({
  monthly_revenue: z.string(),
  monthly_payroll: z.string(),
  startup_capex: z.string(),
  total_startup_cost: z.string(),
  monthly_fixed_costs: z.string(),
  monthly_variable_cost: z.string(),
  monthly_operating_profit: z.string(),
  annual_operating_profit: z.string(),
  break_even_revenue: z.string(),
  target_monthly_revenue: z.string(),
  loan_first_payment: z.string().nullable(),
  loan_total_payment: z.string().nullable(),
  loan_total_interest: z.string().nullable(),
  loan_term_months: z.number().int().nullable(),
  annual_debt_service: z.string().nullable(),
  dscr: z.string().nullable()
});
const restaurantFormatSchema = z.enum([
  "cafe",
  "family",
  "fast_casual",
  "fine_dining"
]);

const planResultSchema = z.object({
  summary: z.string(),
  sections: z.array(z.object({ title: z.string(), content: z.string() })),
  calculations: planCalculationsSchema
});

export type PlanCalculations = z.infer<typeof planCalculationsSchema>;
export type PlanResult = z.infer<typeof planResultSchema>;

type WizardValues = {
  businessName: string;
  restaurantFormat: "cafe" | "family" | "fast_casual" | "fine_dining";
  location: string;
  seats: string;
  menuSummary: string;
  averageCheck: string;
  dailyCustomers: string;
  operatingDays: string;
  rent: string;
  utilities: string;
  variableCostPercent: string;
  cookCount: string;
  cookSalary: string;
  serverCount: string;
  serverSalary: string;
  equipmentCost: string;
  otherStartupCost: string;
  loanAmount: string;
  loanRate: string;
  loanTermMonths: string;
  targetProfit: string;
};

const draftSchema = z.object({
  step: z.number().int().min(0).max(4),
  values: z.object({
    businessName: z.string(),
    restaurantFormat: z.enum(["cafe", "family", "fast_casual", "fine_dining"]),
    location: z.string(),
    seats: z.string(),
    menuSummary: z.string(),
    averageCheck: z.string(),
    dailyCustomers: z.string(),
    operatingDays: z.string(),
    rent: z.string(),
    utilities: z.string(),
    variableCostPercent: z.string(),
    cookCount: z.string(),
    cookSalary: z.string(),
    serverCount: z.string(),
    serverSalary: z.string(),
    equipmentCost: z.string(),
    otherStartupCost: z.string(),
    loanAmount: z.string(),
    loanRate: z.string(),
    loanTermMonths: z.string(),
    targetProfit: z.string()
  })
});

const initialValues: WizardValues = {
  businessName: "",
  restaurantFormat: "family",
  location: "",
  seats: "40",
  menuSummary: "",
  averageCheck: "0",
  dailyCustomers: "0",
  operatingDays: "30",
  rent: "0",
  utilities: "0",
  variableCostPercent: "30",
  cookCount: "10",
  cookSalary: "0",
  serverCount: "20",
  serverSalary: "0",
  equipmentCost: "0",
  otherStartupCost: "0",
  loanAmount: "0",
  loanRate: "0",
  loanTermMonths: "36",
  targetProfit: "0"
};

const stepKeys = ["format", "menu", "staff", "equipment", "financing"] as const;
const draftStorageKey = "finadvisor.restaurant-plan-draft";

export function PlanWizard({
  onGenerated
}: {
  onGenerated: (result: PlanResult) => void;
}) {
  const t = useTranslations("finadvisor.wizard");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const currentStepRef = useRef<HTMLFieldSetElement>(null);
  const [values, setValues] = useState<WizardValues>(initialValues);
  const [step, setStep] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [draftError, setDraftError] = useState<string>();
  const [requestError, setRequestError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const serialized = window.localStorage.getItem(draftStorageKey);
      if (serialized) {
        const parsedDraft = draftSchema.safeParse(JSON.parse(serialized));
        if (parsedDraft.success) {
          setValues(parsedDraft.data.values);
          setStep(parsedDraft.data.step);
        } else {
          setDraftError("draftInvalid");
        }
      }
    } catch {
      setDraftError("draftUnavailable");
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }
    try {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ step, values })
      );
    } catch {
      setDraftError("draftUnavailable");
    }
  }, [draftReady, step, values]);

  const update = (key: keyof WizardValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const input = (
    key: keyof WizardValues,
    label: string,
    options: {
      type?: "text" | "number";
      required?: boolean;
      min?: string;
      step?: string;
      placeholder?: string;
    } = {}
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={`wizard-${key}`}>
        {label}
      </label>
      <Input
        id={`wizard-${key}`}
        min={options.min}
        placeholder={options.placeholder}
        required={options.required}
        step={options.step}
        type={options.type ?? "text"}
        value={values[key]}
        onChange={(event) => update(key, event.target.value)}
      />
    </div>
  );

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(undefined);
    setIsSubmitting(true);
    const payload = {
      locale,
      business_name: values.businessName,
      restaurant_format: values.restaurantFormat,
      location: values.location,
      seats: Number(values.seats),
      menu_summary: values.menuSummary,
      average_check: values.averageCheck,
      daily_customers: Number(values.dailyCustomers),
      operating_days_per_month: Number(values.operatingDays),
      monthly_rent: values.rent,
      monthly_utilities: values.utilities,
      variable_cost_ratio_percent: values.variableCostPercent,
      staff: [
        {
          role: t("roles.cook"),
          employee_count: Number(values.cookCount),
          monthly_salary: values.cookSalary
        },
        {
          role: t("roles.server"),
          employee_count: Number(values.serverCount),
          monthly_salary: values.serverSalary
        }
      ],
      equipment: [
        {
          name: t("equipmentLabel"),
          quantity: "1",
          unit_cost: values.equipmentCost
        }
      ],
      other_startup_cost: values.otherStartupCost,
      loan_amount: values.loanAmount,
      annual_interest_rate_percent: values.loanRate,
      loan_term_months: Number(values.loanTermMonths),
      target_monthly_profit: values.targetProfit
    };

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        setRequestError(
          response.status === 503 ? "planAIUnavailable" : "planGenerationFailed"
        );
        return;
      }
      const result = planResultSchema.parse(body);
      onGenerated(result);
    } catch (error) {
      if (error instanceof TypeError) {
        setRequestError("planServiceUnavailable");
        return;
      }
      if (error instanceof z.ZodError) {
        setRequestError("planGenerationFailed");
        return;
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  function advanceStep() {
    const fields = currentStepRef.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea");
    if (fields && !Array.from(fields).every((field) => field.reportValidity())) {
      return;
    }
    setStep((current) => Math.min(current + 1, stepKeys.length - 1));
  }

  return (
    <Card className="p-5 sm:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            {t("eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{t("title")}</h2>
        </div>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {draftError ? errors(draftError) : t("draftSaved")}
        </p>
      </div>
      <div
        aria-label={t("progress", {
          current: step + 1,
          total: stepKeys.length
        })}
        aria-valuemax={stepKeys.length}
        aria-valuemin={1}
        aria-valuenow={step + 1}
        className="mt-7 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${((step + 1) / stepKeys.length) * 100}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        {stepKeys.map((stepKey, index) => (
          <span
            className={index === step ? "font-semibold text-primary" : ""}
            key={stepKey}
          >
            {t(`steps.${stepKey}.short`)}
          </span>
        ))}
      </div>

      <form className="mt-8" onSubmit={submitPlan}>
        <fieldset className="space-y-5" ref={currentStepRef}>
          <legend className="mb-5 text-lg font-semibold">
            {t(`steps.${stepKeys[step]}.title`)}
          </legend>

          {step === 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {input("businessName", t("businessName"), { required: true })}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="wizard-format">
                  {t("restaurantFormat")}
                </label>
                <Select
                  id="wizard-format"
                  value={values.restaurantFormat}
                  onChange={(event) => {
                    const parsed = restaurantFormatSchema.safeParse(
                      event.target.value
                    );
                    if (parsed.success) {
                      update("restaurantFormat", parsed.data);
                    }
                  }}
                >
                  {(["cafe", "family", "fast_casual", "fine_dining"] as const).map(
                    (format) => (
                      <option key={format} value={format}>
                        {t(`formats.${format}`)}
                      </option>
                    )
                  )}
                </Select>
              </div>
              {input("location", t("location"), { required: true })}
              {input("seats", t("seats"), {
                type: "number",
                min: "1",
                step: "1",
                required: true
              })}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="wizard-menu">
                  {t("menuSummary")}
                </label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  id="wizard-menu"
                  required
                  value={values.menuSummary}
                  onChange={(event) => update("menuSummary", event.target.value)}
                />
              </div>
              {input("averageCheck", t("averageCheck"), {
                type: "number",
                min: "0",
                step: "0.01",
                required: true
              })}
              {input("dailyCustomers", t("dailyCustomers"), {
                type: "number",
                min: "0",
                step: "1",
                required: true
              })}
              {input("operatingDays", t("operatingDays"), {
                type: "number",
                min: "1",
                step: "1",
                required: true
              })}
              {input("variableCostPercent", t("variableCostPercent"), {
                type: "number",
                min: "0",
                max: "99.99",
                step: "0.01",
                required: true
              })}
              {input("rent", t("monthlyRent"), {
                type: "number",
                min: "0",
                step: "0.01",
                required: true
              })}
              {input("utilities", t("monthlyUtilities"), {
                type: "number",
                min: "0",
                step: "0.01",
                required: true
              })}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {input("cookCount", t("staffCount", { role: t("roles.cook") }), {
                type: "number",
                min: "0",
                step: "1",
                required: true
              })}
                  {input("cookSalary", t("monthlySalary", { role: t("roles.cook") }), {
                      type: "number",
                      min: "0",
                      step: "0.01",
                      required: true
                    })}
              {input("serverCount", t("staffCount", { role: t("roles.server") }), {
                      type: "number",
                      min: "0",
                      step: "1",
                      required: true
                    })}
              {input("serverSalary", t("monthlySalary", { role: t("roles.server") }), {
                      type: "number",
                      min: "0",
                      step: "0.01",
                      required: true
                    })}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {input("equipmentCost", t("equipmentCost"), {
                type: "number",
                min: "0",
                step: "0.01",
                required: true
              })}
              {input("otherStartupCost", t("otherStartupCost"), {
                type: "number",
                min: "0",
                step: "0.01",
                required: true
              })}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {input("loanAmount", t("loanAmount"), {
                type: "number",
                min: "0",
                step: "0.01",
                required: true
              })}
              {input("loanRate", t("annualInterestRate"), {
                type: "number",
                min: "0",
                step: "0.01",
                required: true
              })}
              {input("loanTermMonths", t("loanTermMonths"), {
                type: "number",
                min: "0",
                max: "600",
                step: "1",
                required: true
              })}
              {input("targetProfit", t("targetMonthlyProfit"), {
                type: "number",
                step: "0.01",
                required: true
              })}
            </div>
          ) : null}
        </fieldset>

        {requestError ? (
          <p className="mt-5 text-sm text-red-600" role="alert">
            {errors(requestError)}
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
          <Button
            disabled={step === 0 || isSubmitting}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            type="button"
            variant="outline"
          >
            {t("back")}
          </Button>
          {step < stepKeys.length - 1 ? (
            <Button onClick={advanceStep} type="button">
              {t("next")}
            </Button>
          ) : (
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t("generating") : t("generate")}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
