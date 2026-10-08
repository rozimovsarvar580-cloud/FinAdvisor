import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";

import { BusinessPage } from "./business-page";

describe("business page", () => {
  it("presents the Business commission calculator and agent revenue basis", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <BusinessPage />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByRole("heading", {
        name: "See how the desktop agent commission is estimated"
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: "Adjust annual revenue" })
    ).toBeTruthy();
    expect(
      screen.getAllByText(/annual revenue recorded by the desktop agent/).length
    ).toBeGreaterThan(0);
  });
});
