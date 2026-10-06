import { notFound } from "next/navigation";
import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const copy = messages[locale as keyof typeof messages].faq;
  return <main><h1>{copy.title}</h1>{copy.items.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</main>;
}
