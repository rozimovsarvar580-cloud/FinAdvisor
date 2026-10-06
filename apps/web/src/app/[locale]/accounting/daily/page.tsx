import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function DailyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>Daily entries</h1><ul><li>Sales — 8,200,000 UZS</li><li>Supplies — 1,650,000 UZS</li></ul><Link href={`/${locale}/accounting`}>Back</Link></main>;
}
