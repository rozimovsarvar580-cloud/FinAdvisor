import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const sampleBusinessName = "Samarqand Bistro";
  return (
    <main>
      <h1>{t("reports.title")}</h1>
      <p>{t("reports.description")}</p>
      <div className="card-grid">
        <section className="card">
          <h2>{sampleBusinessName}</h2>
          <p>{t("reports.monthlyProfit", { amount: "42,700,000" })}</p>
          <a href={`${apiUrl}/api/v1/plans/plan-001/export.csv`}>{t("common.downloadCsv")}</a>
          <a href={`${apiUrl}/api/v1/plans/plan-001/export.xlsx`}>{t("common.downloadExcel")}</a>
        </section>
        <Link className="card" href={`/${locale}/analysis/plan-001`}><h2>{t("reports.bankReadiness")}</h2><p>{t("reports.openAnalysis")}</p></Link>
      </div>
    </main>
  );
}
