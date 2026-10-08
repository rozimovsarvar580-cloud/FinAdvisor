import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function DownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  return <main><h1>{t("download.title")}</h1><div className="card-grid"><article className="card"><h2>{t("download.windows")}</h2><p>{t("download.comingSoon")}</p></article><article className="card"><h2>{t("download.macos")}</h2><p>{t("download.comingSoon")}</p></article></div></main>;
}
