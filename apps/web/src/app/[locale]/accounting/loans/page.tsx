import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function LoansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const demoBankName = "Demo Bank";
  return <main><h1>{t("accounting.loansTitle")}</h1><p>{demoBankName} — {t("accounting.principal").toLowerCase()} 500,000,000 UZS</p><p>{t("accounting.nextPayment")}: 18,500,000 UZS</p><Link href={`/${locale}/accounting`}>{t("common.back")}</Link></main>;
}
