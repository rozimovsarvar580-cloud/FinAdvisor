"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

type Screen = "inventory" | "sales" | "expenses" | "catalog";
type RecordItem = { id: string; data: Record<string, string> };
const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function AccountantWorkspace() {
  const t = useTranslations("accountant");
  const [screen, setScreen] = useState<Screen>("inventory");
  const [items, setItems] = useState<RecordItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const resource = screen === "inventory" ? "stock-movements" : screen === "catalog" ? "inventory" : screen;
  useEffect(() => {
    let live = true;
    fetch(`/api/accounting/${resource}`, { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject()).then(d => { if (live) setItems(d.items ?? []); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [resource]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError(""); setSaved(false);
    const form = new FormData(formElement);
    const data: Record<string, string> = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    if (screen === "inventory") data.direction = data.direction;
    try {
      const response = await fetch(`/api/accounting/${resource}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error("save");
      setItems(current => [...current, { id: crypto.randomUUID(), data }]); setSaved(true); formElement.reset();
    } catch { setError(t("saveError")); } finally { setBusy(false); }
  }
  const fields: Record<Screen, { name: string; type?: string; required?: boolean; options?: string[] }[]> = {
    inventory: [{ name: "product", required: true }, { name: "quantity", type: "number", required: true }, { name: "direction", options: ["in", "out"] }, { name: "date", type: "date", required: true }],
    sales: [{ name: "product", required: true }, { name: "quantity", type: "number", required: true }, { name: "amount", type: "number", required: true }, { name: "date", type: "date", required: true }],
    expenses: [{ name: "category", required: true }, { name: "amount", type: "number", required: true }, { name: "description" }, { name: "date", type: "date", required: true }],
    catalog: [{ name: "name", required: true }, { name: "unit", required: true }, { name: "quantity", type: "number", required: true }]
  };
  return <section className="mx-auto max-w-4xl space-y-6 p-4 text-foreground sm:p-8">
    <h1 className="text-2xl font-bold">{t("title")}</h1>
    <nav className="flex flex-wrap gap-2" aria-label={t("title")}>{(["inventory", "sales", "expenses", "catalog"] as const).map(key => <button key={key} type="button" onClick={() => setScreen(key)} aria-pressed={screen === key} className="rounded-md border border-border px-4 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t(key)}</button>)}</nav>
    <h2 className="text-xl font-semibold">{t(screen)}</h2>
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {fields[screen].map(field => <label key={field.name} className="grid gap-1 text-sm">{t(field.name)}{field.options ? <select className={inputClass} name={field.name}>{field.options.map(v => <option key={v} value={v}>{t(v)}</option>)}</select> : <input className={inputClass} name={field.name} type={field.type ?? "text"} min={field.type === "number" ? "0.001" : undefined} step={field.type === "number" ? "any" : undefined} required={field.required} aria-required={field.required} />}</label>)}
      <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:col-span-2">{busy ? t("saving") : t("save")}</button>
    </form>
    {error && <p role="alert" className="text-destructive">{error}</p>}{saved && <p role="status">{t("saved")}</p>}
    <ul className="divide-y divide-border rounded-md border border-border">{items.map(item => <li key={item.id} className="p-3">{Object.values(item.data).join(" · ")}</li>)}</ul>
  </section>;
}
