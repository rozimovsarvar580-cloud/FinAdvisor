import Link from "next/link";
import { notFound } from "next/navigation";

import en from "../../../../../../packages/i18n/messages/en.json";
import ru from "../../../../../../packages/i18n/messages/ru.json";
import uz from "../../../../../../packages/i18n/messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>{home.title}</h1>
      <h2>Onboarding</h2>
      <ol>
        <li>Complete company profile — done</li>
        <li>Connect cash flow — in progress</li>
        <li>Build financial plan — pending</li>
      </ol>
      <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
    </main>
  );
}
