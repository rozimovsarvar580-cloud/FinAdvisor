import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { AccountingDashboard } from "./accounting-dashboard";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { accessToken: "test-token" } }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

describe("accounting dashboard", () => {
  it("loads period metrics and presents revenue and stock charts", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const period = url.split("/").pop();
      return Promise.resolve(Response.json({ period, start_date: "2026-10-26", end_date: "2026-10-26", currency: "UZS", revenue: "1000", expenses: "400", profit: "600", taxes: "50", stock: { in: "8", sold: "3", remaining: "5" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<NextIntlClientProvider locale="en" messages={messages as unknown as AbstractIntlMessages}><AccountingDashboard /></NextIntlClientProvider>);
    expect(await screen.findByText("Revenue by period")).toBeDefined();
    expect(screen.getByText("Stock overview")).toBeDefined();
    expect(screen.getAllByText("1,000 UZS").length).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("shows cached reports after the API becomes unavailable", async () => {
    localStorage.setItem("finadvisor.dashboard.reports.v1", JSON.stringify({ day: { period: "day", start_date: "2026-10-26", end_date: "2026-10-26", currency: "UZS", revenue: "1000", expenses: "400", profit: "600", taxes: "50", stock: { in: "8", sold: "3", remaining: "5" } } }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<NextIntlClientProvider locale="en" messages={messages as unknown as AbstractIntlMessages}><AccountingDashboard /></NextIntlClientProvider>);
    expect(await screen.findByText("Offline: showing saved reports.")).toBeDefined();
    expect(screen.getByText("1,000 UZS")).toBeDefined();
  });
});
