import Link from "next/link";
import { notFound } from "next/navigation";

import en from "../../../../../packages/i18n/messages/en.json";
import ru from "../../../../../packages/i18n/messages/ru.json";
import uz from "../../../../../packages/i18n/messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function InvestorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();
  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{home.title}</h1>
      <h2>Investor marketplace</h2>
      <ul>
        <li><Link href={`/${locale}/plans/plan-002`}>Shahar Qosh</Link> — funding need: 850,000,000 UZS</li>
        <li><Link href={`/${locale}/plans/plan-004`}>Choyxona 24</Link> — funding need: 1,200,000,000 UZS</li>
      </ul>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href={`/${locale}/investors/inbox`}>Inbox</Link>
        <Link href={`/${locale}/investors/saved`}>Saved</Link>
        <Link href={`/${locale}/investors/kyc`}>KYC profile</Link>
      </nav>
    </main>
  );
}
