"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/auth";

function getOnboardingRole(role: string | undefined): UserRole {
  if (role === "buxgalter" || role === "investor") return role;
  return "tadbirkor";
}

export default function RoleOnboardingPage() {
  const t = useTranslations("routeCopy.onboardingRole");
  const roles = useTranslations("auth.roles");
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [role, setRole] = useState<UserRole>(getOnboardingRole(session?.user.role));
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (session?.user.role) {
      setRole(getOnboardingRole(session.user.role));
    }
  }, [session?.user.role]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasError(false);
    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      if (!response.ok) {
        setHasError(true);
        return;
      }

      const updatedSession = await update();
      if (updatedSession?.needsRole !== false) {
        setHasError(true);
        return;
      }
      router.replace("/app/finadvisor");
    } catch (error) {
      if (error instanceof TypeError) {
        setHasError(true);
        return;
      }
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="onboarding-role">
              {t("roleLabel")}
            </label>
            <Select
              id="onboarding-role"
              onChange={(event) => setRole(event.target.value as UserRole)}
              value={role}
              disabled={status !== "authenticated" || isSaving}
            >
              <option value="tadbirkor">{roles("tadbirkor")}</option>
              <option value="buxgalter">{roles("buxgalter")}</option>
              <option value="investor">{roles("investor")}</option>
            </Select>
          </div>
          {hasError ? (
            <p className="text-sm text-destructive" role="alert">
              {t("saveFailed")}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={status !== "authenticated" || isSaving}
            type="submit"
          >
            {isSaving ? t("saving") : t("continue")}
          </Button>
        </form>
      </section>
    </main>
  );
}
