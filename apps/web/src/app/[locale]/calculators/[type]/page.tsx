"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";

const locales = ["uz", "ru", "en"] as const;
const allowed = ["credit", "capex", "revenue", "break-even", "reverse"] as const;
type CalculatorType = (typeof allowed)[number];

const labels: Record<CalculatorType, string> = {
  credit: "Credit calculator",
  capex: "Startup cost calculator",
  revenue: "Revenue and profit calculator",
  "break-even": "Break-even calculator",
  reverse: "Reverse credit calculator",
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function CalculatorPage() {
  const params = useParams<{ locale: string; type: string }>();
  const { locale, type } = params;
  const [values, setValues] = useState<Record<string, string>>({
    principal: "120000000",
    monthly_payment: "5000000",
    annual_rate: "24",
    months: "36",
    item_amount: "100000000",
    working_capital: "20000000",
    contingency_rate: "10",
    units: "100",
    price_per_unit: "50000",
    fixed_costs: "10000000",
    variable_cost_rate: "20",
    variable_cost_per_unit: "30000",
  });
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!locales.includes(locale as (typeof locales)[number]) || !allowed.includes(type as CalculatorType)) {
    notFound();
  }
  const calculatorType = type as CalculatorType;

  const fields = useMemo(() => {
    if (calculatorType === "capex") {
      return [
        ["item_amount", "Equipment amount (UZS)"],
        ["working_capital", "Working capital (UZS)"],
        ["contingency_rate", "Contingency (%)"],
      ];
    }
    if (calculatorType === "revenue") {
      return [
        ["units", "Units per period"],
        ["price_per_unit", "Price per unit (UZS)"],
        ["fixed_costs", "Fixed costs (UZS)"],
        ["variable_cost_rate", "Variable costs (%)"],
      ];
    }
    if (calculatorType === "break-even") {
      return [
        ["fixed_costs", "Fixed costs (UZS)"],
        ["price_per_unit", "Price per unit (UZS)"],
        ["variable_cost_per_unit", "Variable cost per unit (UZS)"],
      ];
    }
    if (calculatorType === "reverse") {
      return [
        ["monthly_payment", "Monthly payment (UZS)"],
        ["annual_rate", "Annual rate (%)"],
        ["months", "Term (months)"],
      ];
    }
    return [
      ["principal", "Principal (UZS)"],
      ["annual_rate", "Annual rate (%)"],
      ["months", "Term (months)"],
    ];
  }, [calculatorType]);

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function calculate() {
    setLoading(true);
    setError("");
    setResult(null);
    let endpoint = "/api/v1/calc/credit/annuity";
    let payload: Record<string, unknown>;
    if (calculatorType === "capex") {
      endpoint = "/api/v1/calc/capex";
      payload = {
        items: [{ name: "Main investment", amount: values.item_amount }],
        working_capital: values.working_capital,
        contingency_rate: values.contingency_rate,
      };
    } else if (calculatorType === "revenue") {
      endpoint = "/api/v1/calc/revenue-profit";
      payload = {
        streams: [{ name: "Main revenue", units: values.units, price_per_unit: values.price_per_unit }],
        fixed_costs: values.fixed_costs,
        variable_cost_rate: values.variable_cost_rate,
      };
    } else if (calculatorType === "break-even") {
      endpoint = "/api/v1/calc/break-even";
      payload = {
        fixed_costs: values.fixed_costs,
        price_per_unit: values.price_per_unit,
        variable_cost_per_unit: values.variable_cost_per_unit,
      };
    } else if (calculatorType === "reverse") {
      endpoint = "/api/v1/calc/credit/reverse";
      payload = {
        monthly_payment: values.monthly_payment,
        annual_rate: values.annual_rate,
        months: Number(values.months),
      };
    } else {
      payload = {
        principal: values.principal,
        annual_rate: values.annual_rate,
        months: Number(values.months),
      };
    }
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message ?? "Calculation failed.");
      } else {
        setResult(body.rows[0]);
      }
    } catch {
      setError("The calculation service is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{labels[calculatorType]}</h1>
      <div style={{ display: "grid", gap: 12 }}>
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input value={values[key]} onChange={(event) => updateValue(key, event.target.value)} inputMode="decimal" />
          </label>
        ))}
        <button onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <section className="card">
          <h2>Result</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(result).filter(([key]) => key !== "formula").map(([key, value]) => (
              <p key={key}><strong>{key.replaceAll("_", " ")}:</strong> {value}</p>
            ))}
          </div>
          <p>{result.formula}</p>
        </section>
      )}
      <Link href={`/${locale}/calculators`}>Back to calculators</Link>
    </main>
  );
}
