import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

export const siteConfig = {
  name: "FinAdvisor",
  title: "FinAdvisor | Business plan software for Uzbek restaurants",
  description:
    "FinAdvisor helps restaurant founders build financial plans, forecast cash flow, and prepare for bank readiness in Uzbekistan.",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://finadvisor.uz",
  defaultLocale: routing.defaultLocale,
  locales: routing.locales
};

export function getCanonicalUrl(pathname = "/", locale = routing.defaultLocale) {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+/g, "/");
  const localizedPath = normalizedPath === "/" ? `/${locale}` : `/${locale}${normalizedPath}`;
  return new URL(localizedPath, siteConfig.baseUrl).toString();
}

export function buildMetadata({
  locale = routing.defaultLocale,
  pathname = "/"
}: {
  locale?: string;
  pathname?: string;
} = {}): Metadata {
  const canonicalUrl = getCanonicalUrl(pathname, locale);
  const title = siteConfig.title;
  const description = siteConfig.description;
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
      locale,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
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
