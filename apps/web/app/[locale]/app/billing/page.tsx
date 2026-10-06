import { notFound } from "next/navigation";

const locales = ["uz", "ru", "en"] as const;

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return (
    <main>
      <h1>Billing</h1>
      <section className="card">
        <h2>Starter plan</h2>
        <p>Current period: monthly</p>
        <p>Status: active</p>
        <button type="button" disabled>Manage subscription</button>
      </section>
    </main>
  );
}
