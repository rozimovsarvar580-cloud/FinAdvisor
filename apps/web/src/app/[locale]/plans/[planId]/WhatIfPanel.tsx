"use client";

import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function WhatIfPanel({ planId }: { planId: string }) {
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
      setError(body.message ?? "Scenario calculation failed.");
      return;
    }
    setResult(body);
  }

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h2>What-if scenario</h2>
      <p>Adjust assumptions without changing the saved plan.</p>
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Revenue change (%)
          <input value={revenueChange} onChange={(event) => setRevenueChange(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Cost change (%)
          <input value={costChange} onChange={(event) => setCostChange(event.target.value)} inputMode="decimal" />
        </label>
        <button type="button" onClick={runScenario}>Run scenario</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div>
          <p>Scenario revenue: {result.monthly_revenue} UZS</p>
          <p>Scenario profit: {result.monthly_profit} UZS</p>
        </div>
      )}
    </section>
  );
}
