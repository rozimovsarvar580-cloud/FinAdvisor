import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export function BillingCheckoutReturn({
  outcome
}: {
  outcome: "success" | "cancel";
}) {
  const t = useTranslations(`billing.checkout.return.${outcome}`);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center px-page py-10">
      <Card className="w-full p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("description")}</p>
        <Button asChild className="mt-6">
          <Link href="/app/billing">{t("backToBilling")}</Link>
        </Button>
      </Card>
    </main>
  );
}
