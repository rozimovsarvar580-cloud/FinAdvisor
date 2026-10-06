import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function InventoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>Inventory</h1><ul><li>Rice — 120 kg</li><li>Cooking oil — 24 l (reorder)</li></ul><Link href={`/${locale}/accounting`}>Back</Link></main>;
}
