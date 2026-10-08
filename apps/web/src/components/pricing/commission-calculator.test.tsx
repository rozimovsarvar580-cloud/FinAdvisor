import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import { CommissionCalculator } from "./commission-calculator";

const commissionResponse = {
  annual_revenue: "150000000",
  total_commission: "5000000.00",
  bands: [
    {
      tier: "first_100m",
      revenue_portion: "100000000",
      rate_percent: "4.00",
      commission: "4000000.00"
    },
    {
      tier: "next_900m",
      revenue_portion: "50000000",
      rate_percent: "2.00",
      commission: "1000000.00"
    },
    {
      tier: "above_1b",
      revenue_portion: "0",
      rate_percent: "1.00",
      commission: "0.00"
    }
  ]
};

function renderCalculator() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <CommissionCalculator />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("commission calculator", () => {
  it("synchronizes the slider and input and displays the API's progressive result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => commissionResponse
    });
    vi.stubGlobal("fetch", fetchMock);
    renderCalculator();

    const input = screen.getByRole("textbox", { name: "Annual revenue" });
    const slider = screen.getByRole("slider", {
      name: "Adjust annual revenue"
    });
    fireEvent.change(slider, { target: { value: "150000000" } });
    expect((input as HTMLInputElement).value).toBe("150000000");

    fireEvent.change(input, { target: { value: "150000000" } });
    expect((slider as HTMLInputElement).value).toBe("150000000");
    fireEvent.click(screen.getByRole("button", { name: "Calculate commission" }));

    expect(await screen.findByText("5000000.00")).toBeTruthy();
    expect(
      screen.getByText(/annual revenue recorded by the desktop agent/)
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/pricing/commission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annual_revenue: "150000000" })
    });
  });

  it("shows localized validation and does not call the API for invalid values", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCalculator();

    fireEvent.change(screen.getByRole("textbox", { name: "Annual revenue" }), {
      target: { value: "-1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate commission" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enter a non-negative amount with up to two decimal places."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("announces API service errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "pricing.calculator_unavailable" })
      })
    );
    renderCalculator();

    fireEvent.change(screen.getByRole("textbox", { name: "Annual revenue" }), {
      target: { value: "150000000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate commission" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not connect to the calculator service. Try again later"
    );
  });

  it("disables controls while the API request is loading", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderCalculator();

    fireEvent.change(screen.getByRole("textbox", { name: "Annual revenue" }), {
      target: { value: "150000000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate commission" }));

    expect(
      (screen.getByRole("textbox", {
        name: "Annual revenue"
      }) as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("slider", {
        name: "Adjust annual revenue"
      }) as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Calculating..."
      }) as HTMLButtonElement).disabled
    ).toBe(true);

    resolveRequest?.({
      ok: true,
      json: async () => commissionResponse
    });
    await waitFor(() => expect(screen.getByText("5000000.00")).toBeTruthy());
  });
});
