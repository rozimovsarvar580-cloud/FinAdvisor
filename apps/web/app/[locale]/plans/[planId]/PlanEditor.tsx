"use client";

import { FormEvent, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type PlanEditorProps = {
  planId: string;
  initialName: string;
  initialRevenue: string;
  initialProfit: string;
};

export default function PlanEditor({ planId, initialName, initialRevenue, initialProfit }: PlanEditorProps) {
  const [name, setName] = useState(initialName);
  const [revenue, setRevenue] = useState(initialRevenue);
  const [profit, setProfit] = useState(initialProfit);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const response = await fetch(`${apiUrl}/api/v1/plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, monthly_revenue: revenue, monthly_profit: profit }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message ?? "Could not save the plan.");
      return;
    }
    setMessage(`Saved as version ${body.version}.`);
  }

  return (
    <form onSubmit={save} className="card" style={{ display: "grid", gap: 12, marginTop: 24 }}>
      <h2>Edit plan</h2>
      <label>
        Plan name
        <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
      </label>
      <label>
        Monthly revenue (UZS)
        <input value={revenue} onChange={(event) => setRevenue(event.target.value)} inputMode="decimal" required />
      </label>
      <label>
        Monthly profit (UZS)
        <input value={profit} onChange={(event) => setProfit(event.target.value)} inputMode="decimal" required />
      </label>
      <button type="submit">Save new version</button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
