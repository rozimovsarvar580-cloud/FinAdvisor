import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

import { LoginForm } from "./login-form";

describe("login form order", () => {
  it("places the forgot-password link after the password field and before remember-me", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <LoginForm
          callbackUrl="/en/app"
          providersAvailable={{ google: true, facebook: true }}
        />
      </NextIntlClientProvider>
    );

    const orderedElements = [
      screen.getByLabelText("Email"),
      screen.getByLabelText("Password"),
      screen.getByRole("button", { name: "Show password" }),
      screen.getByRole("link", { name: "Forgot password?" }),
      screen.getByLabelText("Remember me"),
      screen.getByRole("button", { name: "Log in" }),
      screen.getByText("Or continue with"),
      screen.getByRole("button", { name: "Continue with Google" }),
      screen.getByRole("button", { name: "Continue with Facebook" })
    ];

    for (let index = 0; index < orderedElements.length - 1; index += 1) {
      expect(
        orderedElements[index].compareDocumentPosition(
          orderedElements[index + 1]
        ) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }

    expect(
      screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")
    ).toBe("/en/forgot-password");
  });
});
