"use client";

import { useState } from "react";

type RequestRow = { id: string; user_id: string; email: string; full_name: string; organization: string | null; country: string; investment_thesis: string; source_of_funds: string; status: "submitted" | "approved" | "rejected"; review_note: string | null };

export default function InvestorVerificationQueue({ initialItems, accessToken, labels }: { initialItems: RequestRow[]; accessToken: string; labels: { title: string; empty: string; status: string; approve: string; reject: string; submitted: string; approved: string; rejected: string } }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  async function review(row: RequestRow, status: "approved" | "rejected") {
    setBusy(row.id);
    try {
      const response = await fetch(`/api/admin/investor-verifications/${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error("review");
      const result = await response.json();
      setItems((current) => current.map((item) => item.id === row.id ? { ...item, status: result.status, review_note: result.review_note } : item));
    } finally { setBusy(null); }
  }
  return <section aria-labelledby="investor-verification-title" className="mt-10 space-y-4">
    <h2 id="investor-verification-title" className="text-xl font-semibold">{labels.title}</h2>
    {items.length === 0 ? <p>{labels.empty}</p> : items.map((row) => <article key={row.id} className="space-y-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <h3 className="font-semibold">{row.full_name} · {row.email}</h3>
      <p>{row.organization} · {row.country}</p><p>{row.investment_thesis}</p><p>{row.source_of_funds}</p>
      <p>{labels.status}: {labels[row.status]}</p>
      {row.status === "submitted" && <div className="flex gap-3"><button disabled={busy !== null} onClick={() => void review(row, "approved")} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{labels.approve}</button><button disabled={busy !== null} onClick={() => void review(row, "rejected")} className="rounded border border-border px-3 py-2 disabled:opacity-50">{labels.reject}</button></div>}
    </article>)}
  </section>;
}
