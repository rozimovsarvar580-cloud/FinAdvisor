import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { session, push } = vi.hoisted(() => ({
  session: { status: "unauthenticated" as string },
  push: vi.fn()
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: session.status })
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push })
}));

import { PlanSelectButton } from "./plan-select-button";

describe("plan select button", () => {
  beforeEach(() => {
    session.status = "unauthenticated";
    push.mockClear();
  });

  function renderButton() {
    return render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <PlanSelectButton plan="pro" />
      </NextIntlClientProvider>
    );
  }

  it("routes signed-out users to signup with the selected plan", () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Choose plan" }));

    expect(push).toHaveBeenCalledWith("/signup?plan=pro");
  });

  it("routes signed-in users to the existing billing overview", () => {
    session.status = "authenticated";
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "View billing" }));

    expect(push).toHaveBeenCalledWith("/app/billing");
  });

  it("disables the action while the session is loading", () => {
    session.status = "loading";
    renderButton();

    expect(screen.getByRole("button", { name: "Checking..." }).hasAttribute("disabled")).toBe(true);
  });
});
