import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

import { FinAdvisorWorkspace } from "./finadvisor-workspace";

describe("FinAdvisor workspace", () => {
  it("shows the general financial advice disclaimer", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <FinAdvisorWorkspace />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByText(
        "FinAdvisor information is for general purposes and does not replace financial, tax, or legal advice."
      )
    ).toBeDefined();
  });
});
