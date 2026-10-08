import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });

  return (
    <main style={{ maxWidth: 960 }}>
      <h1>{home.title}</h1>
      <h2>{t("dashboard.title")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div className="rounded-xl border border-border p-5">
          <strong>{t("dashboard.monthlyRevenue")}</strong>
          <p>248,000,000 UZS</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <strong>{t("dashboard.monthlyProfit")}</strong>
          <p>42,700,000 UZS</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <strong>{t("dashboard.breakEven")}</strong>
          <p>{t("dashboard.breakEvenDays", { days: 42 })}</p>
        </div>
      </div>
      <nav style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Link href={`/${locale}/dashboard/onboarding`}>{t("dashboard.onboarding")}</Link>
        <Link href={`/${locale}/dashboard/settings`}>{t("dashboard.settings")}</Link>
        <Link href={`/${locale}/dashboard/notifications`}>{t("dashboard.notifications")}</Link>
      </nav>
    </main>
  );
}
