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
import { SocialSignInButtons } from "./social-sign-in-buttons";

const loginSchema = z.object({
  email: z.string().email("emailRequired"),
  password: z.string().min(1, "invalidCredentials"),
  rememberMe: z.boolean()
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false }
  });

  const onSubmit = async (values: LoginValues) => {
    setServerError(undefined);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
        redirect: false,
        callbackUrl
      });

      if (result?.error) {
        setServerError("invalidCredentials");
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
        <h1 className="text-3xl font-semibold tracking-tight">{t("loginTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="login-email">
            {t("email")}
          </label>
          <Input
            autoComplete="email"
            id="login-email"
            type="email"
            {...register("email")}
          />
          {formErrors.email?.message ? (
            <p className="text-sm text-red-600" role="alert">
              {errors(formErrors.email.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="login-password">
              {t("password")}
            </label>
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/login#forgot-password"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            autoComplete="current-password"
            id="login-password"
            type="password"
            {...register("password")}
          />
          {formErrors.password?.message ? (
            <p className="text-sm text-red-600" role="alert">
              {errors(formErrors.password.message)}
            </p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            className="h-4 w-4 rounded border-input accent-primary"
            type="checkbox"
            {...register("rememberMe")}
          />
          {t("rememberMe")}
        </label>

        {serverError ? (
          <p className="text-sm text-red-600" role="alert">
            {errors(serverError)}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("loading") : t("loginSubmit")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("continueWith")}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <SocialSignInButtons callbackUrl={callbackUrl} />
      <p className="mt-7 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          className="font-medium text-primary hover:underline"
          href="/signup"
        >
          {t("signupSubmit")}
        </Link>
      </p>
    </div>
  );
}
