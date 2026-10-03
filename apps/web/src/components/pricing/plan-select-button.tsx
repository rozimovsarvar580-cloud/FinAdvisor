"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

export function PlanSelectButton({ plan }: { plan: string }) {
  const t = useTranslations("pricing");
  const { status } = useSession();
  const router = useRouter();

  return (
    <Button
      className="w-full"
      disabled={status === "loading"}
      onClick={() =>
        router.push(
          status === "authenticated"
            ? `/app/finadvisor?plan=${plan}`
            : `/signup?plan=${plan}`
        )
      }
      variant={plan === "pro" ? "default" : "outline"}
    >
      {t(status === "loading" ? "checkingSession" : "selectPlan")}
    </Button>
  );
}
