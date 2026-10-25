import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import { ForgotPasswordForm } from "./forgot-password-form";
import { ResetPasswordForm } from "./reset-password-form";
import { VerifyEmailForm } from "./verify-email-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithMessages(component: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      {component}
    </NextIntlClientProvider>
  );
}

describe("forgot password form", () => {
  it("shows the non-enumerating success response and submits the email", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "accepted" }), { status: 202 })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText(
        "If the address is registered, a password reset link will be sent."
      )
    ).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com" })
      })
    );
  });

  it("shows the localized error when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );
    renderWithMessages(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText("Could not send the reset link. Please try again.")
    ).toBeDefined();
  });
});

describe("reset password form", () => {
  it("requires matching passwords before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(<ResetPasswordForm token="valid-token" />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass123!" }
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "DifferentPass123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("Passwords do not match")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resets the password and displays success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "auth.password_reset" }), {
        status: 200
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(<ResetPasswordForm token="valid-token" />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass123!" }
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "StrongPass123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText("Your password has been reset. You can now log in.")
    ).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "valid-token", password: "StrongPass123!" })
      })
    );
  });

  it("reports a missing token without exposing a submission form", () => {
    renderWithMessages(<ResetPasswordForm token="" />);

    expect(
      screen.getByText("This password reset link is invalid or has expired.")
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
  });
});

describe("verify email form", () => {
  it("submits the token and displays verification success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "auth.email_verified" }), {
        status: 200
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(<VerifyEmailForm token="verification-token" />);

    expect(
      await screen.findByText("Your email has been verified.")
    ).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/verify-email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "verification-token" })
      })
    );
  });

  it("shows a missing-token error without making a request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithMessages(<VerifyEmailForm token="" />);

    expect(
      screen.getByText("The verification link is missing its token.")
    ).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error for an expired verification token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 400 }))
    );
    renderWithMessages(<VerifyEmailForm token="expired-token" />);

    expect(
      await screen.findByText(
        "This verification link is invalid or has expired."
      )
    ).toBeDefined();
  });
});
