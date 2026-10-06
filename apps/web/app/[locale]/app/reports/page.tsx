import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return (
    <main>
      <h1>Reports</h1>
      <p>Reports are generated from deterministic finance-engine outputs.</p>
      <div className="card-grid">
        <section className="card">
          <h2>Samarqand Bistro</h2>
          <p>Monthly profit: 42,700,000 UZS</p>
          <a href={`${apiUrl}/api/v1/plans/plan-001/export.csv`}>Download CSV</a>
          <a href={`${apiUrl}/api/v1/plans/plan-001/export.xlsx`}>Download Excel</a>
        </section>
        <Link className="card" href={`/${locale}/analysis/plan-001`}><h2>Bank readiness</h2><p>Open analysis and risk explanation.</p></Link>
      </div>
    </main>
  );
}
