import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function TaxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const sourceFile = "tax_rules_2026.yaml";
  return <main><h1>{t("accounting.taxTitle")}</h1><p>{t("accounting.estimatedDue")}: 12,400,000 UZS</p><p>{t("accounting.source")}: {sourceFile}</p><Link href={`/${locale}/accounting`}>{t("common.back")}</Link></main>;
}
