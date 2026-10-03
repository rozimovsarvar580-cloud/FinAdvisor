"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function SocialSignInButtons({
  callbackUrl
}: {
  callbackUrl: string;
}) {
  const t = useTranslations("auth");

  return (
    <div className="space-y-3">
      <Button
        className="w-full border border-border bg-background text-foreground hover:bg-muted"
        onClick={() => signIn("google", { callbackUrl })}
        variant="outline"
      >
        <span
          aria-hidden="true"
          className="bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#EA4335] bg-clip-text font-bold text-transparent"
        >
          G
        </span>
        {t("google")}
      </Button>
      <Button
        className="w-full border border-border bg-background text-foreground hover:bg-muted"
        onClick={() => signIn("facebook", { callbackUrl })}
        variant="outline"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#0866FF] font-bold text-white"
        >
          f
        </span>
        {t("facebook")}
      </Button>
    </div>
  );
}
