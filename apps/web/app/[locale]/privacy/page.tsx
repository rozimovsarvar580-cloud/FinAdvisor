import { notFound } from "next/navigation";
const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!locales.includes(locale as (typeof locales)[number])) notFound(); return <main><h1>Maxfiylik siyosati</h1><p>Shaxsiy ma’lumotlardan foydalanish qoidalari yuridik ko‘rib chiqishdan o‘tadi.</p></main>; }
