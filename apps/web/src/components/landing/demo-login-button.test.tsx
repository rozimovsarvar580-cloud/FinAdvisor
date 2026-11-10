import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";
import uzMessages from "@/messages/uz.json";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace })
}));

import { DemoLoginButton } from "./demo-login-button";

function renderButton(
  locale: "en" | "ru" | "uz",
  messages: typeof enMessages
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages as unknown as AbstractIntlMessages}
    >
      <DemoLoginButton />
    </NextIntlClientProvider>
  );
}

describe("demo login button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["en", enMessages],
    ["ru", ruMessages],
    ["uz", uzMessages]
  ] as const)("logs into the read-only demo in %s", async (locale, messages) => {
    signIn.mockResolvedValue({
      error: null,
      url: `/${locale}/app`
    });
    renderButton(locale, messages);

    fireEvent.click(
      screen.getByRole("button", { name: messages.landing.hero.demoCta })
    );

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        demo: "true",
        redirect: false,
        callbackUrl: `/${locale}/app`
      });
      expect(replace).toHaveBeenCalledWith(`/${locale}/app`);
    });
  });

  it("shows a localized error if the demo account is unavailable", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin" });
    renderButton("en", enMessages);

    fireEvent.click(
      screen.getByRole("button", { name: enMessages.landing.hero.demoCta })
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      enMessages.landing.hero.demoError
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("disables the button while the demo session is being created", async () => {
    let finishSignIn: ((value: { error: null; url: string }) => void) | undefined;
    signIn.mockReturnValue(
      new Promise((resolve) => {
        finishSignIn = resolve;
      })
    );
    renderButton("en", enMessages);

    const button = screen.getByRole("button", {
      name: enMessages.landing.hero.demoCta
    });
    fireEvent.click(button);

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain(enMessages.landing.hero.demoLoading);

    finishSignIn?.({ error: null, url: "/en/app" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/app"));
  });
});
