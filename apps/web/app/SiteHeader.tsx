"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import en from "../../../packages/i18n/messages/en.json";
import ru from "../../../packages/i18n/messages/ru.json";
import uz from "../../../packages/i18n/messages/uz.json";

const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;

function getLocale(pathname: string) {
  const candidate = pathname.split("/")[1];
  return locales.includes(candidate as (typeof locales)[number]) ? candidate : "uz";
}

export default function SiteHeader() {
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const copy = messages[locale as keyof typeof messages].common;
  const pagePath = pathname.replace(/^\/(uz|ru|en)/, "") || "/";
  return (
    <header className="site-header">
      <Link href={`/${locale}`} className="logo">FinAdvisor</Link>
      <nav aria-label={copy.language}>
        <Link href={`/${locale}/features`}>{copy.features}</Link>
        <Link href={`/${locale}/pricing`}>{copy.pricing}</Link>
        <Link href={`/${locale}/investors`}>{copy.investors}</Link>
        <Link href={`/${locale}/about`}>{copy.about}</Link>
      </nav>
      <div className="header-actions">
        <label className="locale-switcher">
          <span className="sr-only">{copy.language}</span>
          <select
            value={locale}
            onChange={(event) => {
              window.location.href = `/${event.target.value}${pagePath}`;
            }}
            aria-label={copy.language}
          >
            {locales.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
          </select>
        </label>
        <ThemeToggle lightLabel={copy.light} darkLabel={copy.dark} />
        <Link href={`/${locale}/login`}>{copy.login}</Link>
        <Link href={`/${locale}/register`} className="button button-primary">{copy.getStarted}</Link>
      </div>
    </header>
  );
}
