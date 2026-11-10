"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { UserRole } from "@/lib/auth";

const destinations: Record<UserRole, readonly string[]> = {
  tadbirkor: ["/app/finadvisor", "/accounting/daily", "/investors"],
  buxgalter: ["/accounting", "/accounting/inventory", "/accounting/daily"],
  investor: ["/investors", "/investors/kyc", "/investors/saved"]
};

function isUserRole(role: unknown): role is UserRole {
  return role === "tadbirkor" || role === "buxgalter" || role === "investor";
}

export function FirstRunGuide() {
  const t = useTranslations("firstRun");
  const pathname = usePathname();
  const session = useSession();
  const [loadedKey, setLoadedKey] = useState<string>();
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [storageError, setStorageError] = useState(false);

  const role = session.data?.user.role;
  const guideRole = isUserRole(role) ? role : undefined;
  const userId = session.data?.user.id;
  const section = pathname.split("/")[2];
  const isProductRoute = ["app", "accounting", "investors"].includes(section ?? "");
  const storageKey =
    session.status === "authenticated" &&
    userId &&
    guideRole &&
    !session.data?.user.isDemo
      ? `finadvisor:first-run:v1:${userId}:${guideRole}`
      : undefined;

  useEffect(() => {
    if (!storageKey || !isProductRoute) return;

    setLoadedKey(undefined);
    setTourStep(null);
    try {
      const saved = window.localStorage.getItem(storageKey)?.split(",") ?? [];
      const completed = [0, 1, 2].filter((step) =>
        saved.includes(`step-${step}`)
      );
      const isFinished = saved.includes("done");
      setCheckedSteps(completed);
      setIsComplete(isFinished);
      setIsOpen(!isFinished);
      setStorageError(false);
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      setCheckedSteps([]);
      setIsComplete(false);
      setIsOpen(true);
      setStorageError(true);
    }
    setLoadedKey(storageKey);
  }, [isProductRoute, storageKey]);

  if (
    !storageKey ||
    !guideRole ||
    !isProductRoute ||
    loadedKey !== storageKey
  ) {
    return null;
  }

  const activeStorageKey = storageKey;

  function saveProgress(steps: number[], complete: boolean) {
    const values = [
      ...steps.map((step) => `step-${step}`),
      ...(complete ? ["done"] : [])
    ];
    try {
      window.localStorage.setItem(activeStorageKey, values.join(","));
      setStorageError(false);
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      setStorageError(true);
    }
  }

  function toggleStep(step: number) {
    const next = checkedSteps.includes(step)
      ? checkedSteps.filter((item) => item !== step)
      : [...checkedSteps, step].sort();
    setCheckedSteps(next);
    setIsComplete(false);
    saveProgress(next, false);
  }

  function completeChecklist() {
    setIsComplete(true);
    setIsOpen(false);
    saveProgress(checkedSteps, true);
  }

  if (isComplete && !isOpen) {
    return (
      <aside className="mx-auto my-5 w-full max-w-7xl px-page">
        <Button onClick={() => setIsOpen(true)} variant="outline">
          {t("reopen")}
        </Button>
      </aside>
    );
  }

  const roleDestinations = destinations[guideRole];
  const roleKey = guideRole;

  return (
    <aside className="mx-auto my-5 w-full max-w-7xl px-page">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="first-run-checklist-title">
            <h3 className="font-semibold" id="first-run-checklist-title">
              {t("checklistTitle")}
            </h3>
            <ol className="mt-3 space-y-4">
              {roleDestinations.map((href, index) => {
                const title = t(`roles.${roleKey}.checklist.${index}.title`);
                return (
                  <li className="flex gap-3" key={href}>
                    <input
                      aria-label={title}
                      checked={checkedSteps.includes(index)}
                      className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onChange={() => toggleStep(index)}
                      type="checkbox"
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(`roles.${roleKey}.checklist.${index}.description`)}
                      </p>
                      <Link
                        className="mt-2 inline-flex rounded-sm text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        href={href}
                      >
                        {t(`roles.${roleKey}.checklist.${index}.action`)}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button
              className="mt-5"
              disabled={checkedSteps.length !== roleDestinations.length}
              onClick={completeChecklist}
            >
              {t("markComplete")}
            </Button>
          </section>

          <section aria-labelledby="first-run-tour-title">
            <h3 className="font-semibold" id="first-run-tour-title">
              {t("tourTitle")}
            </h3>
            {tourStep === null ? (
              <Button
                className="mt-3"
                onClick={() => setTourStep(0)}
                variant="outline"
              >
                {t("startTour")}
              </Button>
            ) : (
              <div
                aria-live="polite"
                className="mt-3 rounded-lg border border-border bg-background p-4"
                role="region"
                aria-label={t("tourTitle")}
              >
                <p className="text-sm text-muted-foreground">
                  {t("tourProgress", {
                    current: tourStep + 1,
                    total: roleDestinations.length
                  })}
                </p>
                <h4 className="mt-2 font-semibold">
                  {t(`roles.${roleKey}.tour.${tourStep}.title`)}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`roles.${roleKey}.tour.${tourStep}.description`)}
                </p>
                <Link
                  className="mt-3 inline-flex rounded-sm text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={roleDestinations[tourStep]}
                >
                  {t(`roles.${roleKey}.tour.${tourStep}.action`)}
                </Link>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={tourStep === 0}
                    onClick={() => setTourStep(tourStep - 1)}
                    variant="outline"
                  >
                    {t("previous")}
                  </Button>
                  {tourStep === roleDestinations.length - 1 ? (
                    <Button onClick={() => setTourStep(null)}>
                      {t("finishTour")}
                    </Button>
                  ) : (
                    <Button onClick={() => setTourStep(tourStep + 1)}>
                      {t("next")}
                    </Button>
                  )}
                  <Button
                    onClick={() => setTourStep(null)}
                    variant="ghost"
                  >
                    {t("skipTour")}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        {storageError ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {t("storageError")}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
