import type { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { ThemeProvider } from "@/components/theme-provider";
import { isSupportedLocale } from "@/lib/locales";
import { buildMetadata } from "@/lib/site-metadata";
import "../globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin", "latin-ext", "cyrillic-ext"],
  variable: "--font-plus-jakarta"
});

const inter = Inter({
  display: "swap",
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter"
});

export function generateStaticParams() {
  return ["uz", "ru", "en"].map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: { locale: string };
}) {
  return buildMetadata({ locale: params.locale, pathname: "/" });
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isSupportedLocale(params.locale)) {
    notFound();
  }

  setRequestLocale(params.locale);
  const messages = await getMessages();

  return (
    <html lang={params.locale} suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${inter.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <Header />
            {children}
            <Footer />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
