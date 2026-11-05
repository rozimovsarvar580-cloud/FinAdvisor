"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/auth";
import type { SocialProviderAvailability } from "@/lib/social-providers";

export function SocialSignInButtons({
  callbackUrl,
  disabled = false,
  role,
  providersAvailable
}: {
  callbackUrl: string;
  disabled?: boolean;
  role?: UserRole;
  providersAvailable: SocialProviderAvailability;
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

  const providerButton = (
    provider: "google" | "facebook",
    available: boolean,
    icon: ReactNode
  ) => {
    const unavailableId = `${provider}-provider-unavailable`;
    return (
      <span
        className="group relative block"
        key={provider}
        title={available ? undefined : t("providerUnavailable")}
      >
        <Button
          aria-describedby={available ? undefined : unavailableId}
          className="w-full border border-border bg-background text-foreground hover:bg-muted"
          disabled={disabled || isStarting || !available}
          onClick={() => startSignIn(provider)}
          variant="outline"
        >
          {icon}
          {t(provider)}
        </Button>
        {!available ? (
          <span className="sr-only" id={unavailableId}>
            {t("providerUnavailable")}
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {providerButton(
        "google",
        providersAvailable.google,
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center"
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
            <path
              className={/* allow-hex */ "fill-[#4285F4]"}
              d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"
            />
            <path
              className={/* allow-hex */ "fill-[#34A853]"}
              d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4.1 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z"
            />
            <path
              className={/* allow-hex */ "fill-[#FBBC05]"}
              d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18l6.9-5.2Z"
            />
            <path
              className={/* allow-hex */ "fill-[#EA4335]"}
              d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.2C14.4 15.5 18.8 12 24 12Z"
            />
          </svg>
        </span>
      )}
      {providerButton(
        "facebook",
        providersAvailable.facebook,
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center"
        >
          <svg
            aria-hidden="true"
            className={/* allow-hex */ "h-5 w-5 fill-[#0866FF]"}
            viewBox="0 0 24 24"
          >
            <path d="M2 2h20v20H2z" />
            <path
              className="fill-white"
              d="M13.4 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v1.8H7v3.1h2.7v8h3.7Z"
            />
          </svg>
        </span>
      )}
      {oauthError ? (
        <p className="text-sm text-destructive" role="alert">
          {errors("oauthSetupFailed")}
        </p>
      ) : null}
    </div>
  );
}
