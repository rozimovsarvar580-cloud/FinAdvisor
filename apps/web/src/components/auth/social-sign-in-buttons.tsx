"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/auth";

export function SocialSignInButtons({
  callbackUrl,
  disabled = false,
  role
}: {
  callbackUrl: string;
  disabled?: boolean;
  role?: UserRole;
}) {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [oauthError, setOauthError] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const startSignIn = async (provider: "google" | "facebook") => {
    setOauthError(false);
    setIsStarting(true);
    try {
      if (role) {
        const response = await fetch("/api/auth/oauth-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role })
        });
        if (!response.ok) {
          setOauthError(true);
          setIsStarting(false);
          return;
        }
      }
      await signIn(provider, { callbackUrl });
    } catch (error) {
      setIsStarting(false);
      if (error instanceof TypeError) {
        setOauthError(true);
        return;
      }
      throw error;
    }
  };

  return (
    <div className="space-y-3">
      <Button
        className="w-full border border-border bg-background text-foreground hover:bg-muted"
        disabled={disabled || isStarting}
        onClick={() => startSignIn("google")}
        variant="outline"
      >
        <span
          aria-hidden="true"
          className={/* allow-hex */ "bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#EA4335] bg-clip-text font-bold text-transparent"}
        >
          G
        </span>
        {t("google")}
      </Button>
      <Button
        className="w-full border border-border bg-background text-foreground hover:bg-muted"
        disabled={disabled || isStarting}
        onClick={() => startSignIn("facebook")}
        variant="outline"
      >
        <span
          aria-hidden="true"
          className={/* allow-hex */ "flex h-5 w-5 items-center justify-center rounded-sm bg-[#0866FF] font-bold text-white"}
        >
          f
        </span>
        {t("facebook")}
      </Button>
      {oauthError ? (
        <p className="text-sm text-red-600" role="alert">
          {errors("oauthSetupFailed")}
        </p>
      ) : null}
    </div>
  );
}
