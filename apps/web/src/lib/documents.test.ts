import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DocumentExportError,
  requestPlanDocument,
  type PlanDocumentPayload
} from "./documents";

const plan: PlanDocumentPayload = {
  summary: "Restaurant plan",
  sections: [{ title: "Operations", content: "Open every day." }],
  markdown: "# Restaurant plan\n\n## Operations\n\nOpen every day.",
  calculations: { monthly_revenue: "150000000.00" },
  assumptions: {
    locale: "uz",
    business_name: "Restaurant",
    restaurant_format: "family",
    location: "Tashkent",
    seats: 40,
    menu_summary: "Local dishes",
    average_check: "100000",
    daily_customers: 50,
    operating_days_per_month: 30,
    monthly_rent: "10000000",
    monthly_utilities: "1000000",
    variable_cost_ratio_percent: "30",
    staff: [{ role: "Cook", employee_count: 5, monthly_salary: "3000000" }],
    equipment: [{ name: "Equipment", quantity: "1", unit_cost: "50000000" }],
    other_startup_cost: "10000000",
    loan_amount: "0",
    annual_interest_rate_percent: "0",
    loan_term_months: 0,
    target_monthly_profit: "10000000"
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPlanDocument", () => {
  it.each([
    ["pdf", "finadvisor-plan-plan-1.pdf"],
    ["excel", "finadvisor-plan-plan-1.xlsx"],
    ["bank-pack", "finadvisor-bank-pack-plan-1.pdf"],
    ["synergy", "finadvisor-agent-synergy-plan-1.pdf"]
  ] as const)("requests %s and returns its download name", async (format, filename) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("document", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestPlanDocument(
      "plan-1",
      format,
      "uz",
      plan,
      "session-access-token"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/documents/plan-1/${format}`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-access-token"
        })
      })
    );
    expect(result.filename).toBe(filename);
    expect(await result.blob.text()).toBe("document");
  });

  it("marks a failed export response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(
      requestPlanDocument("plan-1", "pdf", "uz", plan, "session-access-token")
    ).rejects.toMatchObject({ kind: "failed" });
  });

  it.each([
    [{ detail: "documents.export_plan_required" }, "upgrade-required"],
    [{ detail: "documents.business_plan_required" }, "business-required"],
    [
      {
        detail: {
          code: "plans.feature_not_included",
          feature: "exports",
          upgrade_hint: "pro"
        }
      },
      "upgrade-required"
    ],
    [
      {
        detail: {
          code: "plans.feature_not_included",
          feature: "agent_synergy",
          upgrade_hint: "business"
        }
      },
      "business-required"
    ]
  ] as const)("returns the right tier error", async (body, kind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(body, { status: 403 }))
    );

    await expect(
      requestPlanDocument("plan-1", "pdf", "uz", plan, "session-access-token")
    ).rejects.toMatchObject({ kind });
  });

  it("marks a network failure as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));

    await expect(
      requestPlanDocument("plan-1", "pdf", "uz", plan, "session-access-token")
    ).rejects.toBeInstanceOf(DocumentExportError);
  });
});
