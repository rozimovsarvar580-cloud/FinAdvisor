import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

vi.mock("framer-motion", () => ({
  motion: {
    aside: ({
      children,
      className,
      "aria-label": ariaLabel
    }: {
      children: ReactNode;
      className?: string;
      "aria-label"?: string;
    }) => (
      <aside aria-label={ariaLabel} className={className}>
        {children}
      </aside>
    ),
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>
  },
  useReducedMotion: () => true
}));

import { AuthShell } from "./auth-shell";

describe("authentication shell", () => {
  it("renders its form content and translated brand panel", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <AuthShell>
          <p>Form content</p>
        </AuthShell>
      </NextIntlClientProvider>
    );

    expect(screen.getByText("Form content")).toBeDefined();
    expect(
      screen.getByRole("complementary", {
        name: "Plan your finances with confidence"
      })
    ).toBeDefined();
  });
});
