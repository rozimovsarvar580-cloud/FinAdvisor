import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
<<<<<<< HEAD
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/en/login",
  useSearchParams: () => new URLSearchParams()
}));

import enMessages from "@/messages/en.json";
import { AuthShell } from "./auth-shell";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

function renderWithMessages(children: React.ReactNode) {
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
<<<<<<< HEAD
      {children}
=======
      {component}
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    </NextIntlClientProvider>
  );
}

<<<<<<< HEAD
function fillSignupForm() {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Restaurant Owner" }
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "StrongPass123!" }
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("authentication forms and shell", () => {
  beforeEach(() => {
    mocks.signIn.mockReset();
    mocks.replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the two-column auth shell and its brand panel", () => {
    const { container } = renderWithMessages(
      <AuthShell>
        <p>Auth form</p>
      </AuthShell>
    );

    expect(container.querySelector("main")?.className).toContain("lg:grid-cols-2");
    expect(screen.getByRole("complementary", { name: "Plan your finances with confidence" })).toBeTruthy();
    expect(screen.getByText("Auth form")).toBeTruthy();
  });

  it("shows inline login errors and lets users reveal and hide their password", async () => {
    renderWithMessages(<LoginForm callbackUrl="/en/app" />);

    expect(
      screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")
    ).toBe("/en/forgot-password");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeTruthy();
    expect(screen.getByText("Enter your password")).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");

    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.getAttribute("type")).toBe("password");
  });

  it("passes the remember-me choice and translates failed login responses", async () => {
    mocks.signIn.mockResolvedValue({ error: "CredentialsSignin", url: null });
    renderWithMessages(<LoginForm callbackUrl="/en/app" />);
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" }
    });
<<<<<<< HEAD
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Email or password is incorrect")).toBeTruthy();
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "owner@example.com",
      password: "wrong-password",
      rememberMe: true,
      redirect: false,
      callbackUrl: "/en/app"
    });
  });

  it("validates signup fields, shows password strength, and links legal consent", async () => {
    renderWithMessages(<SignupForm callbackUrl="/en/app" />);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your name")).toBeTruthy();
    expect(screen.getByText("Enter a valid email address")).toBeTruthy();
    expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
    expect(screen.getByText("Agree to the terms to continue")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/en/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/en/privacy");
    const socialSignIn = screen.getByRole("button", {
      name: "Continue with Google"
    });
    expect(socialSignIn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(socialSignIn.hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass123!" }
    });
    expect(
      screen
        .getByRole("meter", { name: "Password strength: Strong" })
        .getAttribute("aria-valuenow")
    ).toBe("4");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
  });

  it("saves signup details and completes the credentials sign-in", async () => {
    let resolveRegistration: (response: Response) => void = () => {
      throw new Error("Registration request was not started");
    };
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRegistration = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    mocks.signIn.mockResolvedValue({ error: null, url: "/en/app" });
    renderWithMessages(<SignupForm callbackUrl="/en/app" />);

    fillSignupForm();
    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "investor" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    const submitButton = await screen.findByRole("button", { name: "Loading..." });
    expect(submitButton.hasAttribute("disabled")).toBe(true);
    expect(submitButton.getAttribute("aria-busy")).toBe("true");
    resolveRegistration(new Response(null, { status: 201 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "owner@example.com",
            name: "Restaurant Owner",
            password: "StrongPass123!",
            role: "investor"
          })
        })
      );
      expect(mocks.signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({
          email: "owner@example.com",
          rememberMe: true,
          callbackUrl: "/en/app"
        })
      );
      expect(mocks.replace).toHaveBeenCalledWith("/en/app");
    });
  });
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
});
