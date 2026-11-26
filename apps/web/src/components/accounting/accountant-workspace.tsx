"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

type Screen = "inventory" | "sales" | "expenses" | "catalog";
type BusinessType = "goods" | "services" | "mixed";
type RecordItem = { id: string; data: Record<string, string> };
type Field = {
  name: string;
  type?: string;
  required?: boolean;
  options?: readonly string[];
};

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function AccountantWorkspace() {
  const t = useTranslations("accountant");
  const [businessType, setBusinessType] = useState<BusinessType>("goods");
  const [profileLoading, setProfileLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("inventory");
  const [catalogType, setCatalogType] = useState<"goods" | "service">("goods");
  const [items, setItems] = useState<RecordItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const availableScreens: Screen[] = businessType === "services"
    ? ["sales", "expenses", "catalog"]
    : ["inventory", "sales", "expenses", "catalog"];
  const resource = screen === "inventory" ? "stock-movements" : screen === "catalog" ? "inventory" : screen;

  useEffect(() => {
    let live = true;
    fetch("/api/accounting/preferences", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        if (!live || !["goods", "services", "mixed"].includes(data.business_type)) return;
        const type = data.business_type as BusinessType;
        setBusinessType(type);
        setCatalogType(type === "services" ? "service" : "goods");
        if (type === "services") setScreen("catalog");
      })
      .catch(() => { if (live) setError(t("loadError")); })
      .finally(() => { if (live) setProfileLoading(false); });
    return () => { live = false; };
  }, [t]);

  useEffect(() => {
    let live = true;
    fetch(`/api/accounting/${resource}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (live) setItems(data.items ?? []); })
      .catch(() => { if (live) setError(t("loadError")); });
    return () => { live = false; };
  }, [resource, t]);

  async function changeBusinessType(value: BusinessType) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/accounting/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: value }),
      });
      if (!response.ok) throw new Error("save");
      const result = await response.json();
      setBusinessType(result.business_type);
      setCatalogType(result.business_type === "services" ? "service" : "goods");
      if (result.business_type === "services" && screen === "inventory") setScreen("catalog");
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    setSaved(false);
    const form = new FormData(formElement);
    const data: Record<string, string> = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
    try {
      const response = await fetch(`/api/accounting/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("save");
      setItems(current => [...current, { id: crypto.randomUUID(), data }]);
      setSaved(true);
      formElement.reset();
      setCatalogType(businessType === "services" ? "service" : "goods");
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  const fields: Record<Screen, Field[]> = {
    inventory: [
      { name: "product", required: true },
      { name: "quantity", type: "number", required: true },
      { name: "direction", options: ["in", "out"] },
      { name: "date", type: "date", required: true },
    ],
    sales: [
      { name: "product", required: true },
      { name: "category", required: true },
      { name: "quantity", type: "number", required: true },
      { name: "amount", type: "number", required: true },
      { name: "date", type: "date", required: true },
    ],
    expenses: [
      { name: "category", required: true },
      { name: "amount", type: "number", required: true },
      { name: "description" },
      { name: "date", type: "date", required: true },
    ],
    catalog: [
      { name: "name", required: true },
      { name: "item_type", options: businessType === "mixed" ? ["goods", "service"] : [businessType === "services" ? "service" : "goods"] },
      { name: "unit", required: true },
      ...(businessType === "services" || (businessType === "mixed" && catalogType === "service")
        ? [{ name: "service_duration_minutes", type: "number" }]
        : []),
    ],
  };

  return <section className="mx-auto max-w-4xl space-y-6 p-4 text-foreground sm:p-8">
    <h1 className="text-2xl font-bold">{t("title")}</h1>
    <label className="grid max-w-sm gap-1 text-sm">
      {t("businessType")}
      <select
        className={inputClass}
        value={businessType}
        disabled={profileLoading || busy}
        onChange={event => void changeBusinessType(event.target.value as BusinessType)}
      >
        {(["goods", "services", "mixed"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}
      </select>
    </label>
    {profileLoading && <p role="status">{t("loading")}</p>}
    <nav className="flex flex-wrap gap-2" aria-label={t("title")}>
      {availableScreens.map(key => <button key={key} type="button" onClick={() => setScreen(key)} aria-pressed={screen === key} className="rounded-md border border-border px-4 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t(key)}</button>)}
    </nav>
    <h2 className="text-xl font-semibold">{t(screen)}</h2>
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {fields[screen].map(field => <label key={field.name} className="grid gap-1 text-sm">
        {t(field.name)}
        {field.options
          ? <select
              className={inputClass}
              name={field.name}
              required={field.required}
              onChange={field.name === "item_type" ? event => setCatalogType(event.target.value as "goods" | "service") : undefined}
            >
              {field.options.map(value => <option key={value} value={value}>{t(value)}</option>)}
            </select>
          : <input className={inputClass} name={field.name} type={field.type ?? "text"} min={field.type === "number" ? "0.001" : undefined} step={field.type === "number" ? "any" : undefined} required={field.required} aria-required={field.required} />}
      </label>)}
      <button disabled={busy || profileLoading} className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:col-span-2">{busy ? t("saving") : t("save")}</button>
    </form>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {saved && <p role="status">{t("saved")}</p>}
    <ul className="divide-y divide-border rounded-md border border-border">{items.map(item => <li key={item.id} className="p-3">{Object.values(item.data).join(" · ")}</li>)}</ul>
  </section>;
}
