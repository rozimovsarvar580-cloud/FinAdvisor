export const supportedLocales = ["uz", "ru", "en"] as const;

export type Locale = (typeof supportedLocales)[number];

export function isSupportedLocale(locale: string): locale is Locale {
  return supportedLocales.some((supportedLocale) => supportedLocale === locale);
}
