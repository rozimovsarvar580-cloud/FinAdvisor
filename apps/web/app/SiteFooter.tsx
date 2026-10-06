"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import en from "../../../packages/i18n/messages/en.json";
import ru from "../../../packages/i18n/messages/ru.json";
import uz from "../../../packages/i18n/messages/uz.json";

const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;

function getLocale(pathname: string) {
  const candidate = pathname.split("/")[1];
  return locales.includes(candidate as (typeof locales)[number]) ? candidate : "uz";
}

export default function SiteFooter() {
  const locale = getLocale(usePathname());
  const copy = messages[locale as keyof typeof messages].common;
  return (
    <footer className="site-footer">
      <div><strong>FinAdvisor</strong><p>{copy.reliablePlanning}</p></div>
      <div>
        <strong>{copy.product}</strong>
        <Link href={`/${locale}/features`}>{copy.features}</Link>
        <Link href={`/${locale}/pricing`}>{copy.pricing}</Link>
        <Link href={`/${locale}/download`}>{copy.download}</Link>
      </div>
      <div>
        <strong>{copy.help}</strong>
        <Link href={`/${locale}/faq`}>FAQ</Link>
        <Link href={`/${locale}/privacy`}>{copy.privacy}</Link>
        <Link href={`/${locale}/terms`}>{copy.terms}</Link>
      </div>
      <div><strong>{copy.disclaimer}</strong><p>{copy.disclaimerText}</p></div>
    </footer>
  );
}
