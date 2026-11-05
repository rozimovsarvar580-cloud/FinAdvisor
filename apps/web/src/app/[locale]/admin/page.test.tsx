import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession, getTranslations } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key)
}));

vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("next-intl/server", () => ({ getTranslations }));

import AdminPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

const emptyRevenueReport = {
  as_of: "2026-11-05T00:00:00Z",
  period_start: "2026-10-06T00:00:00Z",
  active_subscribers_total: 0,
  active_subscribers_by_plan: { pro: 0, business: 0 },
  cancellations_30d: 0,
  cancellation_rate_percent_30d: null,
  failed_payment_attempts_30d: 0,
  weekly_recurring_revenue: [],
  monthly_recurring_revenue: [],
  gross_subscription_payments_7d: [],
  accrued_commission: [],
  ai_cost_usd_30d: "0",
  ai_cost_complete_30d: true,
  ai_cost_is_estimate_30d: false,
  users: []
};

function adminResponse(url: string) {
  if (url.endsWith("/admin/ai-status")) {
    return new Response(
      JSON.stringify({
        connected: true,
        provider: "openai",
        model: "test-model"
      }),
      { status: 200 }
    );
  }
  return new Response(JSON.stringify(emptyRevenueReport), { status: 200 });
}

describe("admin page", () => {
  it("server-fetches safe AI status with the authenticated admin token", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({
      accessToken: "admin-access-token",
      user: { role: "admin" }
    });
    const fetchMock = vi.fn(async (url: string) => adminResponse(url));
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ locale: "en" }) })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/admin/ai-status",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.any(String)
        }),
        cache: "no-store"
      })
    );
    expect(markup).toContain("admin.aiConnected");
    expect(markup).toContain("openai");
    expect(markup).toContain("test-model");
    expect(markup).not.toContain("admin-access-token");
  });

  it("renders revenue metrics and user comparisons from the admin API", async () => {
    getServerSession.mockResolvedValue({
      accessToken: "admin-access-token",
      user: { role: "admin" }
    });
    const report = {
      ...emptyRevenueReport,
      active_subscribers_total: 2,
      active_subscribers_by_plan: { pro: 1, business: 1 },
      weekly_recurring_revenue: [
        { currency: "USD", amount_minor: 1000, amount: "10.00" }
      ],
      users: [
        {
          user_id: "owner-id",
          email: "owner@example.test",
          ai_cost_usd: "0.12",
          ai_cost_complete: false,
          ai_cost_is_estimate: true,
          subscription_revenue_30d: [
            { currency: "USD", amount_minor: 2000, amount: "20.00" }
          ]
        }
      ]
    };
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/admin/revenue")
        ? new Response(JSON.stringify(report), { status: 200 })
        : adminResponse(url)
    );
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ locale: "en" }) })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/admin/revenue",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.any(String)
        }),
        cache: "no-store"
      })
    );
    expect(markup).toContain("admin.revenueTitle");
    expect(markup).toContain("admin.exportRevenueCsv");
    expect(markup).toContain("owner@example.test");
    expect(markup).toContain("admin.aiCostTitle");
    expect(markup).not.toContain("admin-access-token");
  });

  it("does not fetch admin data for a non-admin session", async () => {
    getServerSession.mockResolvedValue({
      accessToken: "owner-access-token",
      user: { role: "tadbirkor" }
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ locale: "en" }) })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(markup).toContain("admin.aiStatusUnavailable");
    expect(markup).toContain("admin.revenueUnavailable");
  });

  it("does not render unexpected AI response fields", async () => {
    getServerSession.mockResolvedValue({
      accessToken: "admin-access-token",
      user: { role: "admin" }
    });
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/admin/ai-status")
        ? new Response(
            JSON.stringify({
              connected: true,
              provider: "openai",
              model: "test-model",
              api_key: "must-not-render"
            }),
            { status: 200 }
          )
        : adminResponse(url)
    );
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ locale: "en" }) })
    );

    expect(markup).toContain("admin.aiStatusUnavailable");
    expect(markup).not.toContain("must-not-render");
  });
});
