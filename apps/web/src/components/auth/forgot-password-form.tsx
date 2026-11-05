"use client";

<<<<<<< HEAD
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
=======
import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

<<<<<<< HEAD
const emailSchema = z.object({
  email: z.string().trim().email("emailRequired")
});

type RequestState = "idle" | "loading" | "success" | "error";

export function ForgotPasswordForm() {
  const t = useTranslations("authFlows");
  const auth = useTranslations("auth");
  const errors = useTranslations("errors");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [emailError, setEmailError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState("idle");
    setEmailError(undefined);
    const formData = new FormData(event.currentTarget);
    const parsed = emailSchema.safeParse({
      email: String(formData.get("email") ?? "")
    });
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "emailRequired");
      return;
    }

    setRequestState("loading");
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
<<<<<<< HEAD
        body: JSON.stringify(parsed.data),
        cache: "no-store"
      });
      setRequestState(response.ok ? "success" : "error");
    } catch (error) {
      if (error instanceof TypeError) {
        setRequestState("error");
=======
        body: JSON.stringify({ email })
      });
      setStatus(response.ok ? "success" : "error");
    } catch (error) {
      if (error instanceof TypeError) {
        setStatus("error");
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        return;
      }
      throw error;
    }
<<<<<<< HEAD
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("forgotTitle")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("forgotDescription")}
      </p>
      <form className="mt-8 space-y-5" noValidate onSubmit={submit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="forgot-email">
            {auth("email")}
          </label>
          <Input
            aria-describedby={emailError ? "forgot-email-error" : undefined}
            aria-invalid={Boolean(emailError)}
            autoComplete="email"
            id="forgot-email"
            name="email"
            required
            type="email"
          />
          {emailError ? (
            <p className="text-sm text-red-600" id="forgot-email-error" role="alert">
              {errors(emailError)}
            </p>
          ) : null}
        </div>
        {requestState === "success" ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("forgotSuccess")}
          </p>
        ) : null}
        {requestState === "error" ? (
          <p className="text-sm text-red-600" role="alert">
            {t("forgotError")}
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={requestState === "loading"}
          loading={requestState === "loading"}
          type="submit"
        >
          {requestState === "loading" ? t("sending") : t("forgotSubmit")}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link className="font-medium text-primary hover:underline" href="/login">
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
