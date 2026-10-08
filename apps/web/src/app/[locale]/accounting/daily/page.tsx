import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function DailyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  return <main><h1>{t("accounting.dailyTitle")}</h1><ul><li>{t("accounting.sales")} — 8,200,000 UZS</li><li>{t("accounting.supplies")} — 1,650,000 UZS</li></ul><Link href={`/${locale}/accounting`}>{t("common.back")}</Link></main>;
}
