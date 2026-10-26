"use client";

import { useState } from "react";

type UserRow = { id: string; email: string; role: string; is_suspended: boolean; subscription_plan: string };

export default function AdminUserControls({ rows, token, apiUrl, labels }: { rows: UserRow[]; token: string; apiUrl: string; labels: { role: string; suspend: string; unsuspend: string; saved: string; roles: Record<string, string> } }) {
  const [users, setUsers] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  async function update(id: string, changes: { role?: string; is_suspended?: boolean }) {
    setBusy(id);
    try {
      const response = await fetch(`${apiUrl}/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!response.ok) return;
      setUsers((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
    } finally { setBusy(null); }
  }
  return <ul>{users.map((row) => <li className="flex flex-wrap items-center gap-2 py-1" key={row.id}>
    <span>{row.email} ({row.subscription_plan})</span>
    <label>{labels.role}<select aria-label={`${labels.role}: ${row.email}`} disabled={busy === row.id} className="rounded border border-border bg-background px-2 py-1" value={row.role} onChange={(event) => void update(row.id, { role: event.target.value })}><option value="tadbirkor">{labels.roles.tadbirkor}</option><option value="buxgalter">{labels.roles.buxgalter}</option><option value="investor">{labels.roles.investor}</option></select></label>
    <button disabled={busy === row.id} className="rounded border border-border px-3 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50" onClick={() => void update(row.id, { is_suspended: !row.is_suspended })}>{row.is_suspended ? labels.unsuspend : labels.suspend}</button>
    {busy === row.id && <span role="status">{labels.saved}</span>}
  </li>)}</ul>;
}
