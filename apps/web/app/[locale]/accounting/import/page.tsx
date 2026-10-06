import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function ImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>Import statement</h1><p>CSV/XLSX statement upload will be processed here.</p><input type="file" accept=".csv,.xlsx" /><br /><Link href={`/${locale}/accounting`}>Back</Link></main>;
}
