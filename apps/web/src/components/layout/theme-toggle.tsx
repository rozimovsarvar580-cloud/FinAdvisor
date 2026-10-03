"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("common");

  return (
    <Button
      aria-label={t("theme")}
      aria-pressed={resolvedTheme === "dark"}
      data-testid="theme-toggle"
      onClick={() =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
      size="icon"
      variant="ghost"
    >
      <span aria-hidden="true" className="text-lg">
        ◐
      </span>
    </Button>
  );
}
