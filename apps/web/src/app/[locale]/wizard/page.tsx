import Link from "next/link";
import { notFound } from "next/navigation";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function WizardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{home.title}</h1>
      <h2>Plan wizard</h2>
      <ol>
        <li>Restaurant profile</li>
        <li>Setup costs</li>
        <li>Staffing</li>
        <li>Scenario review</li>
      </ol>
      <Link href={`/${locale}/wizard/steps`}>Start wizard</Link>
    </main>
  );
}
