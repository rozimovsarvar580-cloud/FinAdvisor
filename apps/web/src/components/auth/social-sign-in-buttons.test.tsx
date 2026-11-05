import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn }));

import { SocialSignInButtons } from "./social-sign-in-buttons";

beforeEach(() => {
  signIn.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderButtons({
  google = true,
  facebook = true,
  role
}: {
  google?: boolean;
  facebook?: boolean;
  role?: "tadbirkor" | "buxgalter" | "investor";
} = {}) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <SocialSignInButtons
        callbackUrl="/en/app"
        providersAvailable={{ google, facebook }}
        role={role}
      />
    </NextIntlClientProvider>
  );
}

describe("social sign-in buttons", () => {
  it("disables only providers missing server-side configuration and explains why", () => {
    renderButtons({ google: true, facebook: false });

    expect(screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled"))
      .toBe(false);
    const facebookButton = screen.getByRole("button", {
      name: "Continue with Facebook"
    });
    expect(facebookButton.hasAttribute("disabled")).toBe(true);
    expect(facebookButton.getAttribute("aria-describedby")).toBe(
      "facebook-provider-unavailable"
    );
    expect(
      screen.getByText("Social sign-in is not configured").textContent
    ).toBe("Social sign-in is not configured");
  });

  it("stores the selected signup role before starting the provider sign-in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderButtons({ role: "investor" });

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/oauth-role",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ role: "investor" })
        })
      );
      expect(signIn).toHaveBeenCalledWith("google", {
        callbackUrl: "/en/app"
      });
    });
  });

  it("shows a translated error and does not start sign-in if the role request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    );
    renderButtons({ role: "tadbirkor" });

    fireEvent.click(screen.getByRole("button", { name: "Continue with Facebook" }));

    expect(
      await screen.findByText(
        "Could not start social sign-in. Try again later"
      )
    ).toBeDefined();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("disables the providers and skips clicks while the parent form is disabled", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <SocialSignInButtons
          callbackUrl="/en/app"
          disabled
          providersAvailable={{ google: true, facebook: true }}
        />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(
      screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled")
    ).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
  });
});
