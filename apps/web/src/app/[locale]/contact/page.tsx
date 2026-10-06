import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <main style={{ maxWidth: 640 }}><h1>Aloqa</h1><form style={{ display: "grid", gap: 12 }}><label>Ism<input required /></label><label>Email<input type="email" required /></label><label>Xabar<textarea required /></label><button type="submit">Yuborish</button></form><p>Telegram: @finadvisor · Email: hello@finadvisor.uz</p></main>;
}
