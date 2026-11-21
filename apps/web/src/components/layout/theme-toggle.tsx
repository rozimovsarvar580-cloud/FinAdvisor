"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function ThemeToggle({ testId }: { testId?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("common");

  return (
    <Button
      aria-label={t("theme")}
      aria-pressed={resolvedTheme === "dark"}
      data-testid={testId}
      onClick={() => {
        document.documentElement.classList.add("theme-transition");
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        window.setTimeout(() => {
          document.documentElement.classList.remove("theme-transition");
        }, 300);
      }}
      size="icon"
      variant="ghost"
    >
      <Icon
        className="h-5 w-5"
        name={resolvedTheme === "dark" ? "sun" : "moon"}
      />
    </Button>
  );
}
