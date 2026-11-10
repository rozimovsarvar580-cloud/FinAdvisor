"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function DemoLoginButton() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("landing.hero");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<"demoError" | "demoConnectionFailed">();
  const callbackUrl = `/${locale}/app`;

  const enterDemo = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await signIn("credentials", {
        demo: "true",
        redirect: false,
        callbackUrl
      });
      if (!result || result.error) {
        setError("demoError");
        return;
      }
      router.replace(result.url ?? callbackUrl);
    } catch (caught) {
      if (caught instanceof TypeError) {
        setError("demoConnectionFailed");
        return;
      }
      throw caught;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={loading}
        loading={loading}
        onClick={enterDemo}
        size="lg"
        variant="outline"
      >
        {t(loading ? "demoLoading" : "demoCta")}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
