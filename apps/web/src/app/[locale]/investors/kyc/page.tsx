import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function KycPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>KYC profile</h1><p>Status: pending</p><p>Identity, source of funds, agreement</p><Link href={`/${locale}/investors`}>Back</Link></main>;
}
