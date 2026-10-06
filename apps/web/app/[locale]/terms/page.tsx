import { notFound } from "next/navigation";
const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!locales.includes(locale as (typeof locales)[number])) notFound(); return <main><h1>Foydalanish shartlari</h1><p>Bu sahifa yuridik mutaxassis tomonidan tasdiqlanadigan shablon hisoblanadi.</p></main>; }
