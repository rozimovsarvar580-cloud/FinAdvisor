import { notFound } from "next/navigation";
const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function DisclaimerPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!locales.includes(locale as (typeof locales)[number])) notFound(); return <main><h1>Javobgarlik cheklovi</h1><p>AI natijalari kafolat emas va moliyaviy yoki yuridik maslahat o‘rnini bosmaydi.</p></main>; }
