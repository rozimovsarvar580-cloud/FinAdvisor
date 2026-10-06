import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main><h1>Biz haqimizda</h1><h2>Missiya</h2><p>O‘zbekistondagi tadbirkorlarga moliyaviy rejalashtirishni sodda, aniq va tushunarli qilish.</p><h2>Qanday ishlaymiz?</h2><p>Hisob-kitobni finance-engine bajaradi, AI esa natijalarni izohlaydi.</p></main>;
}
