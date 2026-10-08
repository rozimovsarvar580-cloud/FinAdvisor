"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoadingSkeleton() {
  const t = useTranslations("routeStates");

  return (
    <main className="mx-auto min-h-[50vh] max-w-7xl px-page py-section">
      <div
        aria-busy="true"
        aria-label={t("loading")}
        className="space-y-6"
        role="status"
      >
        <Skeleton className="h-10 w-2/3 max-w-md motion-reduce:animate-none" />
        <Skeleton className="h-5 w-full max-w-2xl motion-reduce:animate-none" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card className="space-y-4 p-6" key={index}>
              <Skeleton className="h-6 w-2/3 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-full motion-reduce:animate-none" />
              <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

export function RouteStatus({
  variant,
  onRetry
}: {
  variant: "notFound" | "error";
  onRetry?: () => void;
}) {
  const t = useTranslations("routeStates");
  const isNotFound = variant === "notFound";

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-page py-section">
      <Card className="w-full p-8 text-center sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          FinAdvisor
        </p>
        {isNotFound ? (
          <p aria-hidden="true" className="mt-5 text-6xl font-bold tracking-tight text-primary">
            404
          </p>
        ) : null}
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t(isNotFound ? "notFoundTitle" : "errorTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          {t(isNotFound ? "notFoundDescription" : "errorDescription")}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {!isNotFound && onRetry ? (
            <Button onClick={onRetry}>{t("retry")}</Button>
          ) : null}
          <Button asChild variant={isNotFound ? "primary" : "outline"}>
            <Link href="/">{t("home")}</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
