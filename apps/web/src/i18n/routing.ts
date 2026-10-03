import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uz", "ru", "en"],
  defaultLocale: "uz",
  localePrefix: "always",
  localeCookie: {
    name: "NEXT_LOCALE",
    sameSite: "lax"
  }
});
