import Link from "next/link";
import { notFound } from "next/navigation";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 960 }}>
      <h1>{home.title}</h1>
      <h2>Business plans</h2>
      <ul>
        <li><Link href={`/${locale}/plans/plan-001`}>Samarqand Bistro</Link> — Draft</li>
        <li><Link href={`/${locale}/plans/plan-002`}>Shahar Qosh</Link> — Review</li>
      </ul>
      <Link href={`/${locale}/plans/new`}>Create new plan</Link>
    </main>
  );
}
