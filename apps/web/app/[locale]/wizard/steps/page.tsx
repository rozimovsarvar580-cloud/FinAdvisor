import Link from "next/link";
import { notFound } from "next/navigation";

import en from "../../../../../../packages/i18n/messages/en.json";
import ru from "../../../../../../packages/i18n/messages/ru.json";
import uz from "../../../../../../packages/i18n/messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function WizardStepsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{home.title}</h1>
      <h2>Wizard steps</h2>
      <ol>
        <li>Restaurant profile — done</li>
        <li>Setup costs — in progress</li>
        <li>Staffing — pending</li>
        <li>Scenario review — pending</li>
      </ol>
      <Link href={`/${locale}/wizard`}>Back to wizard</Link>
    </main>
  );
}
