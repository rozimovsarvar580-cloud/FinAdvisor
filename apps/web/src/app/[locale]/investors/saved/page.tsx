import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const savedBusinessName = "Shahar Qosh";
  return <main><h1>{t("investors.savedTitle")}</h1><p>{savedBusinessName}</p><Link href={`/${locale}/investors`}>{t("common.back")}</Link></main>;
}
