import Link from "next/link";
import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function AgentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return (
    <main>
      <h1>Desktop agent</h1>
      <p>Devices: Office PC — not connected</p>
      <p>Command history: sync_statement — queued</p>
      <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
    </main>
  );
}
