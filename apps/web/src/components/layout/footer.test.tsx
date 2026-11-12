import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

vi.mock("@/i18n/navigation", () => ({ Link: "a" }));

import { Footer } from "./footer";

describe("footer product links", () => {
  it("links to the localized changelog and live service status page", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={en as unknown as AbstractIntlMessages}
      >
        <Footer />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("link", { name: en.common.footer.changelog }).getAttribute("href"))
      .toBe("/changelog");
    expect(screen.getByRole("link", { name: en.common.footer.statusPage }).getAttribute("href"))
      .toBe("/status");
    expect(
      screen.getByRole("link", { name: en.common.footer.investorBrief }).getAttribute("href")
    ).toBe("/investor");
  });
});
