"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getPasswordStrength } from "@/lib/password-strength";
import { SocialSignInButtons } from "./social-sign-in-buttons";

const signupSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(200, "nameTooLong"),
  email: z.string().email("emailRequired"),
  password: z
    .string()
    .min(8, "passwordTooShort")
    .max(128, "passwordTooLong"),
  role: z.enum(["tadbirkor", "buxgalter", "investor"]),
  terms: z.boolean().refine(Boolean, "termsRequired")
});

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [serverError, setServerError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "tadbirkor",
      terms: false
    }
  });
  const passwordStrength = getPasswordStrength(watch("password") ?? "");
  const selectedRole = watch("role") ?? "tadbirkor";
  const strengthLabel = [
    "",
    t("strengthLevels.weak"),
    t("strengthLevels.fair"),
    t("strengthLevels.good"),
    t("strengthLevels.strong")
  ][passwordStrength];

  const onSubmit = async (values: SignupValues) => {
    setServerError(undefined);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          name: values.name,
          password: values.password,
          role: values.role
        })
      });

      if (response.status === 409) {
        setError("email", { message: "emailInUse" });
        return;
      }
      if (!response.ok) {
        setServerError("signupFailed");
        return;
      }

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        rememberMe: true,
        redirect: false,
        callbackUrl
      });
      if (result?.error) {
        setServerError("signupFailed");
        return;
      }
      router.replace(result?.url ?? callbackUrl);
    } catch (error) {
      if (error instanceof TypeError) {
        setServerError("connectionFailed");
        return;
      }
      throw error;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("signupTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("signupSubtitle")}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="signup-name">
            {t("name")}
          </label>
          <Input
            aria-describedby={formErrors.name ? "signup-name-error" : undefined}
            aria-invalid={Boolean(formErrors.name)}
            autoComplete="name"
            id="signup-name"
            {...register("name")}
          />
          {formErrors.name?.message ? (
            <p className="text-sm text-red-600" id="signup-name-error" role="alert">
              {errors(formErrors.name.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="signup-email">
            {t("email")}
          </label>
          <Input
            aria-describedby={
              formErrors.email ? "signup-email-error" : undefined
            }
            aria-invalid={Boolean(formErrors.email)}
            autoComplete="email"
            id="signup-email"
            type="email"
            {...register("email")}
          />
          {formErrors.email?.message ? (
            <p className="text-sm text-red-600" id="signup-email-error" role="alert">
              {errors(formErrors.email.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium" htmlFor="signup-password">
              {t("password")}
            </label>
            <span className="text-xs text-muted-foreground">
              {t("strength")}: {strengthLabel}
            </span>
          </div>
          <div className="relative">
            <Input
              aria-describedby={
                formErrors.password ? "signup-password-error" : undefined
              }
              aria-invalid={Boolean(formErrors.password)}
              autoComplete="new-password"
              className="pr-24"
              id="signup-password"
              type={showPassword ? "text" : "password"}
              {...register("password")}
            />
            <Button
              aria-label={t(showPassword ? "hidePassword" : "showPassword")}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2"
              disabled={isSubmitting}
              onClick={() => setShowPassword((visible) => !visible)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t(showPassword ? "hidePassword" : "showPassword")}
            </Button>
          </div>
          <div
            aria-label={`${t("strength")}: ${strengthLabel}`}
            aria-valuemax={4}
            aria-valuemin={0}
            aria-valuenow={passwordStrength}
            className="grid grid-cols-4 gap-1"
            role="meter"
          >
            {[1, 2, 3, 4].map((level) => (
              <span
                aria-hidden="true"
                className={`h-1 rounded-full ${
                  passwordStrength >= level ? "bg-primary" : "bg-muted"
                }`}
                key={level}
              />
            ))}
          </div>
          {formErrors.password?.message ? (
            <p className="text-sm text-red-600" id="signup-password-error" role="alert">
              {errors(formErrors.password.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="signup-role">
            {t("role")}
          </label>
          <Select id="signup-role" {...register("role")}>
            <option value="tadbirkor">{t("roles.tadbirkor")}</option>
            <option value="buxgalter">{t("roles.buxgalter")}</option>
            <option value="investor">{t("roles.investor")}</option>
          </Select>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            aria-describedby={formErrors.terms ? "signup-terms-error" : undefined}
            aria-invalid={Boolean(formErrors.terms)}
            aria-labelledby="signup-terms-consent"
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            type="checkbox"
            {...register("terms")}
          />
          <span id="signup-terms-consent">
            {t.rich("termsConsent", {
              terms: (chunks) => (
                <Link className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/terms">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/privacy">
                  {chunks}
                </Link>
              )
            })}
          </span>
        </div>
        {formErrors.terms?.message ? (
          <p className="text-sm text-red-600" id="signup-terms-error" role="alert">
            {errors(formErrors.terms.message)}
          </p>
        ) : null}

        {serverError ? (
          <p className="text-sm text-red-600" role="alert">
            {errors(serverError)}
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={isSubmitting}
          loading={isSubmitting}
          type="submit"
        >
          {isSubmitting ? t("loading") : t("signupSubmit")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("continueWith")}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <SocialSignInButtons
        callbackUrl={callbackUrl}
        disabled={!watch("terms")}
        role={selectedRole}
      />
      <p className="mt-7 text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link
          className="font-medium text-primary hover:underline"
          href="/login"
        >
          {t("loginSubmit")}
        </Link>
      </p>
    </div>
  );
}
