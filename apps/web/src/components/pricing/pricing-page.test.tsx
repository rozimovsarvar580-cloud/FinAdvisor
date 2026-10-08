import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

vi.mock("@/components/pricing/plan-select-button", () => ({
  PlanSelectButton: () => null
}));

import { PricingPage } from "./pricing-page";

describe("pricing page", () => {
  it("shows all plans, the highlighted plan, comparison, FAQ, and draft notice", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <PricingPage />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Free" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pro" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Business" })).toBeTruthy();
    expect(screen.getByText("Popular")).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Billing period" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "What is included in each plan?" })
    ).toBeTruthy();
    expect(screen.getByText(/draft only.*TODO\(H8\)/)).toBeTruthy();
    expect(screen.getByText(/Online checkout is not connected yet/)).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: "Adjust annual revenue" })
    ).toBeTruthy();

    const criteriaHeader = screen.getByRole("columnheader", { name: "Feature" });
    expect(criteriaHeader.parentElement?.parentElement?.className).toContain(
      "sticky"
    );
    expect(screen.getByRole("table").parentElement?.className).toContain(
      "max-h-[min(70vh,38rem)]"
    );
  });

  it("shows D1 placeholder notice with the derived monthly prices", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <PricingPage />
      </NextIntlClientProvider>
    );

    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));

    expect(screen.getByText("$40")).toBeTruthy();
    expect(screen.getByText("$80")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "TODO(DECISION D1)"
    );
  });
});
