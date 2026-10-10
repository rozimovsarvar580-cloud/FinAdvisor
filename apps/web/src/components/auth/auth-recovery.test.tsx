import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";
import uzMessages from "@/messages/uz.json";
import ForgotPasswordPage from "@/app/[locale]/(auth)/forgot-password/page";
import VerifyEmailPage from "@/app/[locale]/(auth)/verify-email/page";
import ResetPasswordPage from "@/app/[locale]/reset-password/page";

const locales = [
  ["en", enMessages],
  ["ru", ruMessages],
  ["uz", uzMessages]
] as const;

function renderWithMessages(
  locale: string,
  messages: AbstractIntlMessages,
  children: React.ReactNode
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("localized account recovery pages", () => {
  it.each(locales)("shows localized forgot-password success and error states in %s", async (locale, messages) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = renderWithMessages(
      locale,
      messages as unknown as AbstractIntlMessages,
      <ForgotPasswordPage />
    );

    fireEvent.change(screen.getByLabelText(messages.auth.email), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: messages.authFlows.forgotSubmit }));
    expect((await screen.findByRole("status")).textContent).toBe(
      messages.authFlows.forgotSuccess
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      expect.objectContaining({
        body: JSON.stringify({ email: "owner@example.com" })
      })
    );

    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    rerender(
      <NextIntlClientProvider
        locale={locale}
        messages={messages as unknown as AbstractIntlMessages}
      >
        <ForgotPasswordPage />
      </NextIntlClientProvider>
    );
    fireEvent.change(screen.getByLabelText(messages.auth.email), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: messages.authFlows.forgotSubmit }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      messages.authFlows.forgotError
    );
  });

  it("validates email before requesting a password reset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(
      "en",
      enMessages as unknown as AbstractIntlMessages,
      <ForgotPasswordPage />
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the emailed token to reset a password and shows invalid-token errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = renderWithMessages(
      "en",
      enMessages as unknown as AbstractIntlMessages,
      <ResetPasswordPage searchParams={{ token: "reset-token" }} />
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewStrongPass123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      enMessages.authFlows.resetSuccess
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({
        body: JSON.stringify({
          token: "reset-token",
          password: "NewStrongPass123!"
        })
      })
    );

    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));
    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <ResetPasswordPage searchParams={{ token: "expired-token" }} />
      </NextIntlClientProvider>
    );
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewStrongPass123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      enMessages.authFlows.resetError
    );
  });

  it("requires a reset token and validates the replacement password", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(
      "en",
      enMessages as unknown as AbstractIntlMessages,
      <ResetPasswordPage />
    );

    expect(screen.getByRole("alert").textContent).toBe(
      enMessages.authFlows.missingToken
    );
    expect(screen.getByRole("button", { name: "Save password" }).hasAttribute("disabled")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies a supplied email token and reports verification failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = renderWithMessages(
      "en",
      enMessages as unknown as AbstractIntlMessages,
      <VerifyEmailPage searchParams={{ token: "verify-token" }} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      enMessages.authFlows.verifySuccess
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/verify-email",
      expect.objectContaining({
        body: JSON.stringify({ token: "verify-token" })
      })
    );

    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));
    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <VerifyEmailPage searchParams={{ token: "expired-token" }} />
      </NextIntlClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      enMessages.authFlows.verifyError
    );
  });

  it("does not submit email verification without a token", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(
      "en",
      enMessages as unknown as AbstractIntlMessages,
      <VerifyEmailPage />
    );

    expect(screen.getByRole("alert").textContent).toBe(
      enMessages.authFlows.missingToken
    );
    expect(screen.getByRole("button", { name: "Verify email" }).hasAttribute("disabled")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
