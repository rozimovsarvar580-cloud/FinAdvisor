import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { replace, signIn } = vi.hoisted(() => ({
  replace: vi.fn(),
  signIn: vi.fn()
}));

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace })
}));
vi.mock("./social-sign-in-buttons", () => ({
  SocialSignInButtons: ({
    disabled
  }: {
    disabled?: boolean;
  }) => (
    <button disabled={disabled} type="button">
      Continue with Google
    </button>
  )
}));

import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  replace.mockReset();
  signIn.mockReset();
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

describe("login form", () => {
  it("toggles password visibility and shows inline email validation", async () => {
    renderWithMessages(
      <LoginForm
        callbackUrl="/en/app"
        providersAvailable={{ google: true, facebook: true }}
      />
    );
    const password = screen.getByLabelText("Password");

    expect(password.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect((await screen.findByText("Enter a valid email address")).textContent)
      .toBe("Enter a valid email address");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("submits credentials and remember-me state to NextAuth", async () => {
    signIn.mockResolvedValue({ error: null, url: "/en/app/finadvisor" });
    renderWithMessages(
      <LoginForm
        callbackUrl="/en/app"
        providersAvailable={{ google: true, facebook: true }}
      />
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass123!" }
    });
    fireEvent.click(screen.getByLabelText("Remember me"));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "owner@example.com",
        password: "StrongPass123!",
        rememberMe: true,
        redirect: false,
        callbackUrl: "/en/app"
      });
      expect(replace).toHaveBeenCalledWith("/en/app/finadvisor");
    });
  });

  it("shows a translated credential error returned by NextAuth", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin" });
    renderWithMessages(
      <LoginForm
        callbackUrl="/en/app"
        providersAvailable={{ google: true, facebook: true }}
      />
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect((await screen.findByText("Email or password is incorrect")).textContent)
      .toBe("Email or password is incorrect");
  });
});

describe("signup form", () => {
  it("toggles password visibility and enforces terms before social sign-in", () => {
    renderWithMessages(
      <SignupForm
        callbackUrl="/en/app"
        providersAvailable={{ google: true, facebook: true }}
      />
    );

    expect(
      screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")
    ).toBe("/en/terms");
    expect(
      screen
        .getByRole("button", { name: "Continue with Google" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
      "password"
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");

    fireEvent.click(screen.getByLabelText(/I agree to the/));
    expect(
      screen
        .getByRole("button", { name: "Continue with Google" })
        .hasAttribute("disabled")
    ).toBe(false);
  });

  it("creates the account, signs in, and redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    );
    signIn.mockResolvedValue({ error: null, url: "/en/app" });
    renderWithMessages(
      <SignupForm
        callbackUrl="/en/app"
        providersAvailable={{ google: true, facebook: true }}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Restaurant Owner" }
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass123!" }
    });
    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "investor" }
    });
    fireEvent.click(screen.getByLabelText(/I agree to the/));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "owner@example.com",
        password: "StrongPass123!",
        rememberMe: true,
        redirect: false,
        callbackUrl: "/en/app"
      });
      expect(replace).toHaveBeenCalledWith("/en/app");
    });
  });

  it("shows a translated server error when the email is already registered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 409 }))
    );
    renderWithMessages(
      <SignupForm
        callbackUrl="/en/app"
        providersAvailable={{ google: true, facebook: true }}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Restaurant Owner" }
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass123!" }
    });
    fireEvent.click(screen.getByLabelText(/I agree to the/));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      (await screen.findByText("An account with this email already exists"))
        .textContent
    ).toBe("An account with this email already exists");
    expect(signIn).not.toHaveBeenCalled();
  });
});
