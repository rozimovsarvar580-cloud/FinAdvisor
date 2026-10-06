import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;

export default async function AppSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return (
    <main>
      <h1>Settings</h1>
      <section className="card">
        <h2>Active session</h2>
        <p>Your browser session is protected by the FinAdvisor token.</p>
        <p>To end it on this device, use Sign out in the sidebar.</p>
        <Link href={`/${locale}/dashboard/settings`}>Open profile settings</Link>
      </section>
    </main>
  );
}
