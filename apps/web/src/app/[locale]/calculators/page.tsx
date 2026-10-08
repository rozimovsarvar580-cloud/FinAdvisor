import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function CalculatorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const calculators = ["credit", "capex", "revenue", "break-even", "reverse"] as const;
  return <main><h1>{t("calculator.title")}</h1><div className="card-grid">{calculators.map((id) => <Link className="card" href={`/${locale}/calculators/${id}`} key={id}><h2>{t(`calculator.labels.${id}`)}</h2><p>{t("calculator.description")}</p></Link>)}</div></main>;
}
