import type { Metadata } from "next";

import { routing } from "@/i18n/routing";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import { isSupportedLocale, type Locale } from "@/lib/locales";

const messages = { en, ru, uz } as const;
export const siteConfig = {
  name: "FinAdvisor",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://finadvisor.uz",
  defaultLocale: routing.defaultLocale,
  locales: routing.locales
};

function getLocale(locale: string): Locale {
  return isSupportedLocale(locale) ? locale : siteConfig.defaultLocale;
}

export function getCanonicalUrl(pathname = "/", locale = routing.defaultLocale) {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+/g, "/");
  const localizedPath =
    normalizedPath === "/"
      ? `/${getLocale(locale)}`
      : `/${getLocale(locale)}${normalizedPath}`;
  return new URL(localizedPath, siteConfig.baseUrl).toString();
}

export function buildMetadata({
  locale = routing.defaultLocale,
  pathname = "/"
}: {
  locale?: string;
  pathname?: string;
} = {}): Metadata {
  const localizedLocale = getLocale(locale);
  const copy = messages[localizedLocale];
  const canonicalUrl = getCanonicalUrl(pathname, localizedLocale);
  const title = `${siteConfig.name} | ${copy.landing.hero.title}`;
  const description = copy.landing.hero.description;
  const languages = Object.fromEntries(
    routing.locales.map((item) => {
      const localizedPath = pathname === "/" ? `/${item}` : `/${item}${pathname}`;
      return [item, new URL(localizedPath, siteConfig.baseUrl).toString()];
    })
  );

  return {
    metadataBase: new URL(siteConfig.baseUrl),
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: localizedLocale,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildProductStructuredData(locale = routing.defaultLocale) {
  const localizedLocale = getLocale(locale);
  const copy = messages[localizedLocale];
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: localizedLocale,
    url: getCanonicalUrl("/", localizedLocale),
    description: copy.landing.hero.description
  };
}

export function buildSitemapEntries() {
  const routes = [
    "/",
    "/about",
    "/pricing",
    "/desktop-agent",
    "/login",
    "/signup",
    "/faq"
  ];

  return routes.flatMap((route) =>
    routing.locales.map((locale) => {
      const localizedPath = route === "/" ? `/${locale}` : `/${locale}${route}`;
      return {
        url: new URL(localizedPath, siteConfig.baseUrl).toString(),
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: route === "/" ? 1 : 0.7
      };
    })
  );
}
