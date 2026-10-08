import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  return <main style={{ maxWidth: 640 }}><h1>{t("contact.title")}</h1><form style={{ display: "grid", gap: 12 }}><label>{t("contact.name")}<input required /></label><label>{t("contact.email")}<input type="email" required /></label><label>{t("contact.message")}<textarea required /></label><button type="submit">{t("contact.send")}</button></form><p>{t("contact.contactInfo", { telegram: "@finadvisor", email: "hello@finadvisor.uz" })}</p></main>;
}
