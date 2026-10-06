import { notFound } from "next/navigation";
import en from "../../../../../packages/i18n/messages/en.json";
import ru from "../../../../../packages/i18n/messages/ru.json";
import uz from "../../../../../packages/i18n/messages/uz.json";

const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const copy = messages[locale as keyof typeof messages].features;
  return <main><h1>{copy.title}</h1><p>{copy.description}</p><div className="card-grid">{copy.items.map(([item, description]) => <article className="card" key={item}><h2>{item}</h2><p>{description}</p></article>)}</div></main>;
}
