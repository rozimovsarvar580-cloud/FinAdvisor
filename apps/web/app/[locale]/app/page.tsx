import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function AppOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return (
    <main>
      <h1>Workspace overview</h1>
      <p>Review your plans, calculations, and financial reports from one place.</p>
      <div className="card-grid">
        <Link className="card" href={`/${locale}/plans`}><h2>Business plans</h2><p>Continue planning and review saved versions.</p></Link>
        <Link className="card" href={`/${locale}/app/reports`}><h2>Reports</h2><p>Export and review finance-engine results.</p></Link>
        <Link className="card" href={`/${locale}/app/billing`}><h2>Billing</h2><p>View your current subscription.</p></Link>
      </div>
    </main>
  );
}
