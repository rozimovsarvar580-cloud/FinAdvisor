"use client";

import { useLocale, useTranslations } from "next-intl";

import { Select } from "@/components/ui/select";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <div>
      <label className="sr-only" htmlFor="locale-switcher">
        {t("language")}
      </label>
      <Select
        aria-label={t("language")}
        className="h-9 w-[7.5rem] px-2"
        id="locale-switcher"
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value });
        }}
        value={locale}
      >
        {routing.locales.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {t(`localeNames.${supportedLocale}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
