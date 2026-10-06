import Link from "next/link";
import { notFound } from "next/navigation";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";
import WhatIfPanel from "./WhatIfPanel";
import PlanEditor from "./PlanEditor";
import AiExplanation from "./AiExplanation";

const messages = { uz, ru, en } as const;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale, planId: "plan-001" }));
}

export default async function PlanDetailsPage({ params }: { params: Promise<{ locale: string; planId: string }> }) {
  const { locale, planId } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>{home.title}</h1>
      <h2>Plan: {planId}</h2>
      <ul>
        <li>Currency: UZS</li>
        <li>Monthly revenue: 248,000,000</li>
        <li>Monthly profit: 42,700,000</li>
      </ul>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href={`${apiUrl}/api/v1/plans/${planId}/export.csv`}>Download CSV</a>
        <a href={`${apiUrl}/api/v1/plans/${planId}/export.xlsx`}>Download Excel</a>
        <a href={`${apiUrl}/api/v1/plans/${planId}/report`}>View report data</a>
      </div>
      <WhatIfPanel planId={planId} />
      <PlanEditor
        planId={planId}
        initialName={planId === "plan-001" ? "Samarqand Bistro" : planId}
        initialRevenue="248000000"
        initialProfit="42700000"
      />
      <AiExplanation
        planId={planId}
        result={{ monthly_revenue: "248000000", monthly_profit: "42700000", currency: "UZS" }}
      />
      <Link href={`/${locale}/plans`}>Back to plans</Link>
    </main>
  );
}
