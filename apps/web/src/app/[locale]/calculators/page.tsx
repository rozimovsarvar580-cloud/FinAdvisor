import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function CalculatorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const calculators = [
    ["credit", "Kredit kalkulyatori"],
    ["capex", "Boshlang‘ich xarajatlar"],
    ["revenue", "Daromad va foyda"],
    ["break-even", "Break-even"],
    ["reverse", "Teskari hisob"],
  ];
  return <main><h1>Kalkulyatorlar</h1><div className="card-grid">{calculators.map(([id, title]) => <Link className="card" href={`/${locale}/calculators/${id}`} key={id}><h2>{title}</h2><p>Natija va formula izohi bilan.</p></Link>)}</div></main>;
}
