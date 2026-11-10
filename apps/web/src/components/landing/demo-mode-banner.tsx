"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

export function DemoModeBanner() {
  const { data, status } = useSession();
  const t = useTranslations("landing.hero");

  if (status !== "authenticated" || !data?.user?.isDemo) {
    return null;
  }

  return (
    <aside
      className="border-b border-primary/30 bg-primary/5 px-page py-3 text-center text-sm text-foreground"
      role="status"
    >
      {t("demoReadOnlyBanner")}
    </aside>
  );
}
