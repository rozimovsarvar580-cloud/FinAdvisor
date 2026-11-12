import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
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
  return (
    <main className="mx-auto max-w-4xl px-page py-section">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {copy.description}
        </p>
      </header>
      <div className="space-y-3">
        {copy.items.map(([question, answer]) => (
          <details
            className="group rounded-xl border border-border bg-card p-5 open:border-primary/40"
            key={question}
          >
            <summary className="cursor-pointer rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
      <Link
        className="mt-8 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
        href="/contact"
      >
        {copy.contact}
      </Link>
    </main>
  );
}
