import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function DownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>FinAdvisor Agent</h1><div className="card-grid"><article className="card"><h2>Windows</h2><p>Tez orada.</p></article><article className="card"><h2>macOS</h2><p>Tez orada.</p></article></div></main>;
}
