import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { sessionState } = vi.hoisted(() => ({
  sessionState: {
    status: "authenticated",
    data: {
      user: { id: "first-run-user", role: "tadbirkor", isDemo: false }
    }
  }
}));

vi.mock("next-auth/react", () => ({
  useSession: () => sessionState
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/app/finadvisor"
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

import { FirstRunGuide } from "./first-run-guide";

function renderGuide() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <FirstRunGuide />
    </NextIntlClientProvider>
  );
}

describe("first-run guide", () => {
  beforeEach(() => {
    window.localStorage.clear();
    sessionState.status = "authenticated";
    sessionState.data.user.role = "tadbirkor";
  });

  it.each([
    ["tadbirkor", "Draft a business plan", "Build a business plan"],
    ["buxgalter", "Review the accounting workspace", "Start in accounting"],
    ["investor", "Browse available projects", "Browse projects"]
  ])("shows role-specific checklist and tour for %s", (role, checklist, tour) => {
    sessionState.data.user.role = role;
    renderGuide();

    expect(screen.getByRole("checkbox", { name: checklist })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Start the tour" }));
    expect(screen.getByRole("heading", { name: tour, level: 4 })).toBeDefined();
  });

  it("persists checklist completion and lets the user reopen it", () => {
    renderGuide();
    for (const label of [
      "Draft a business plan",
      "Record daily activity",
      "Prepare a project listing"
    ]) {
      fireEvent.click(screen.getByRole("checkbox", { name: label }));
    }

    fireEvent.click(screen.getByRole("button", { name: "Mark checklist complete" }));

    expect(
      window.localStorage.getItem("finadvisor:first-run:v1:first-run-user:tadbirkor")
    ).toBe("step-0,step-1,step-2,done");
    fireEvent.click(screen.getByRole("button", { name: "Reopen your checklist" }));
    expect(screen.getByRole("heading", { name: "First-run checklist" })).toBeDefined();
  });
});
