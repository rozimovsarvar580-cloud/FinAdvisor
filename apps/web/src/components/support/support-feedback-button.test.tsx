import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

const mocks = vi.hoisted(() => ({
  pathname: "/en/app",
  session: { status: "authenticated", data: { user: { name: "Owner", email: "owner@example.com" } } }
}));

vi.mock("next-auth/react", () => ({ useSession: () => mocks.session }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import { SupportFeedbackButton } from "./support-feedback-button";

function renderButton() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={en as unknown as AbstractIntlMessages}
    >
      <SupportFeedbackButton />
    </NextIntlClientProvider>
  );
}

describe("support feedback button", () => {
  it("shows the feedback form only on an authenticated product page", () => {
    const view = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(screen.getByRole("heading", { name: "Share product feedback" })).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Owner");
    expect(screen.getByLabelText("Email address")).toHaveProperty("value", "owner@example.com");

    view.unmount();
    mocks.session.status = "unauthenticated";
    renderButton();
    expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
    mocks.session.status = "authenticated";
  });
});
