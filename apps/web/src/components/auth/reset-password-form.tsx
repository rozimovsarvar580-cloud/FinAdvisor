"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "passwordTooShort")
      .max(128, "passwordTooLong"),
    confirmation: z.string().min(1, "passwordConfirmationRequired")
  })
  .refine((values) => values.password === values.confirmation, {
    path: ["confirmation"],
    message: "passwordsDoNotMatch"
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("routeCopy.resetPassword");
  const errors = useTranslations("errors");
  const [status, setStatus] = useState<
    "idle" | "success" | "invalid-token" | "error"
  >(token ? "idle" : "invalid-token");
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmation: "" }
  });

  const onSubmit = async ({ password }: ResetPasswordValues) => {
    setStatus("idle");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      if (response.ok) {
        setStatus("success");
      } else {
        setStatus(response.status === 400 ? "invalid-token" : "error");
      }
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
      {status === "success" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("success")}
        </p>
      ) : null}
      {status === "invalid-token" ? (
        <p className="text-sm text-destructive" role="alert">
          {t("invalidToken")}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {t("error")}
        </p>
      ) : null}
      {status !== "success" && token ? (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reset-password">
              {t("password")}
            </label>
            <Input
              autoComplete="new-password"
              id="reset-password"
              type="password"
              {...register("password")}
            />
            {formErrors.password?.message ? (
              <p className="text-sm text-destructive" role="alert">
                {errors(formErrors.password.message)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="reset-password-confirmation"
            >
              {t("confirmation")}
            </label>
            <Input
              autoComplete="new-password"
              id="reset-password-confirmation"
              type="password"
              {...register("confirmation")}
            />
            {formErrors.confirmation?.message ? (
              <p className="text-sm text-destructive" role="alert">
                {errors(formErrors.confirmation.message)}
              </p>
            ) : null}
          </div>
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      ) : null}
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
