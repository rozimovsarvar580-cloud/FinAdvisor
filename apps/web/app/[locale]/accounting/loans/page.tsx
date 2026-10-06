import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function LoansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>Loans</h1><p>Demo Bank — principal 500,000,000 UZS</p><p>Next payment: 18,500,000 UZS</p><Link href={`/${locale}/accounting`}>Back</Link></main>;
}
