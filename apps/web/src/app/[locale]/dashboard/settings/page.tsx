import Link from "next/link";
import { notFound } from "next/navigation";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>{home.title}</h1>
      <h2>Settings</h2>
      <ul>
        <li>Currency: UZS</li>
        <li>Language: {locale}</li>
        <li>Email notifications: enabled</li>
      </ul>
      <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
    </main>
  );
}
