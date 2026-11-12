import { notFound } from "next/navigation";

import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;
const release = { version: "v6", date: "2026-11-10" } as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function ChangelogPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();

  const copy = messages[locale as keyof typeof messages].changelog;
  return (
    <main className="mx-auto max-w-4xl px-page py-section">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {copy.description}
        </p>
      </header>
      <article className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{copy.release}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-foreground">{release.version}</span>
          <time dateTime={release.date}>{release.date}</time>
        </div>
        <h2 className="mt-4 text-xl font-semibold">{copy.releaseTitle}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          {copy.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </article>
    </main>
  );
}
