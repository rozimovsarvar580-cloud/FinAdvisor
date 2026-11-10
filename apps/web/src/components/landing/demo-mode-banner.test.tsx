import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn()
}));

import { useSession } from "next-auth/react";

import { DemoModeBanner } from "./demo-mode-banner";

describe("demo mode banner", () => {
  it("announces the read-only sample session", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { isDemo: true } },
      status: "authenticated",
      update: vi.fn()
    } as never);

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <DemoModeBanner />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("status").textContent).toContain(
      enMessages.landing.hero.demoReadOnlyBanner
    );
  });

  it("does not display for regular sessions", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { isDemo: false } },
      status: "authenticated",
      update: vi.fn()
    } as never);

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <DemoModeBanner />
      </NextIntlClientProvider>
    );

    expect(screen.queryByRole("status")).toBeNull();
  });
});
