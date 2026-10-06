import Link from "next/link";
import { notFound } from "next/navigation";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 960 }}>
      <h1>{home.title}</h1>
      <h2>Dashboard</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div style={{ padding: 20, border: "1px solid #dfe3ea", borderRadius: 12 }}>
          <strong>Monthly revenue</strong>
          <p>248,000,000 UZS</p>
        </div>
        <div style={{ padding: 20, border: "1px solid #dfe3ea", borderRadius: 12 }}>
          <strong>Monthly profit</strong>
          <p>42,700,000 UZS</p>
        </div>
        <div style={{ padding: 20, border: "1px solid #dfe3ea", borderRadius: 12 }}>
          <strong>Break-even</strong>
          <p>42 days</p>
        </div>
      </div>
      <nav style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Link href={`/${locale}/dashboard/onboarding`}>Onboarding</Link>
        <Link href={`/${locale}/dashboard/settings`}>Settings</Link>
        <Link href={`/${locale}/dashboard/notifications`}>Notifications</Link>
      </nav>
    </main>
  );
}
