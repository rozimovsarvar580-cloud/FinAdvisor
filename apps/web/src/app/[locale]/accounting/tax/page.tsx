import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function TaxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>Tax</h1><p>Estimated due: 12,400,000 UZS</p><p>Source: tax_rules_2026.yaml</p><Link href={`/${locale}/accounting`}>Back</Link></main>;
}
