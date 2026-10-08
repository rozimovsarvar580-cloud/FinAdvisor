"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function WhatIfPanel({ planId }: { planId: string }) {
  const t = useTranslations("routeCopy");
  const [revenueChange, setRevenueChange] = useState("0");
  const [costChange, setCostChange] = useState("0");
  const [result, setResult] = useState<{ monthly_revenue: string; monthly_profit: string } | null>(null);
  const [error, setError] = useState("");

  async function runScenario() {
    setError("");
    const response = await fetch(`${apiUrl}/api/v1/plans/${planId}/what-if`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revenue_change_percent: revenueChange,
        cost_change_percent: costChange,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message ?? t("plans.errors.scenarioFailed"));
      return;
    }
    setResult(body);
  }

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h2>{t("plans.scenarioTitle")}</h2>
      <p>{t("plans.scenarioDescription")}</p>
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          {t("plans.revenueChange")}
          <input value={revenueChange} onChange={(event) => setRevenueChange(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          {t("plans.costChange")}
          <input value={costChange} onChange={(event) => setCostChange(event.target.value)} inputMode="decimal" />
        </label>
        <button type="button" onClick={runScenario}>{t("plans.runScenario")}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div>
          <p>{t("plans.scenarioRevenue")} {result.monthly_revenue} UZS</p>
          <p>{t("plans.scenarioProfit")} {result.monthly_profit} UZS</p>
        </div>
      )}
    </section>
  );
}
