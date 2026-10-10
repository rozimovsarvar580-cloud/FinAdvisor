"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const roles: UserRole[] = ["tadbirkor", "buxgalter", "investor"];

export function RoleOnboardingForm() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const t = useTranslations("auth");
  const [role, setRole] = useState<UserRole>(
    session?.user.role ?? "tadbirkor"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const canSubmit =
    status === "authenticated" &&
    Boolean(session?.accessToken) &&
    !session?.refreshError;

  async function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSaving) {
      return;
    }

    setHasError(false);
    setIsSaving(true);
    try {
      const updatedSession = await update({ role });
      if (
        !updatedSession ||
        updatedSession.needsRole ||
        updatedSession.roleUpdateError
      ) {
        setHasError(true);
        return;
      }
      router.replace("/app");
    } catch {
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("onboardingRoleTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("onboardingRoleDescription")}
        </p>
        <form className="mt-8 space-y-6" onSubmit={submitRole}>
          <fieldset className="space-y-3" disabled={isSaving}>
            <legend className="mb-3 text-sm font-semibold text-foreground">
              {t("role")}
            </legend>
            {roles.map((option) => (
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background motion-reduce:transition-none ${
                  role === option
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background"
                }`}
                key={option}
              >
                <input
                  checked={role === option}
                  className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  name="role"
                  onChange={() => setRole(option)}
                  type="radio"
                  value={option}
                />
                <span className="font-medium text-foreground">
                  {t(`roles.${option}`)}
                </span>
              </label>
            ))}
          </fieldset>
          {hasError ? (
            <p className="text-sm text-destructive" role="alert">
              {t("onboardingRoleError")}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={!canSubmit || isSaving}
            loading={isSaving}
            type="submit"
          >
            {isSaving ? t("onboardingRoleSaving") : t("onboardingRoleSubmit")}
          </Button>
        </form>
      </section>
    </main>
  );
}
