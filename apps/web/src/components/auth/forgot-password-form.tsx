"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "emailRequired").email("emailRequired")
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const t = useTranslations("routeCopy.forgotPassword");
  const errors = useTranslations("errors");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" }
  });

  const onSubmit = async ({ email }: ForgotPasswordValues) => {
    setStatus("idle");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setStatus(response.ok ? "success" : "error");
    } catch (error) {
      if (error instanceof TypeError) {
        setStatus("error");
        return;
      }
      throw error;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="forgot-password-email">
            {t("email")}
          </label>
          <Input
            autoComplete="email"
            id="forgot-password-email"
            type="email"
            {...register("email")}
          />
          {formErrors.email?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {errors(formErrors.email.message)}
            </p>
          ) : null}
        </div>
        {status === "success" ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("sent")}
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {t("error")}
          </p>
        ) : null}
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
      <p className="mt-6 text-sm">
        <Link
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/login"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
