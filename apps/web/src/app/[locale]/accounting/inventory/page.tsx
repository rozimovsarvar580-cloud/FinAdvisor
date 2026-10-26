import { notFound } from "next/navigation";
import { AccountantWorkspace } from "@/components/accounting/accountant-workspace";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function InventoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><AccountantWorkspace /></main>;
}
