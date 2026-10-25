import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import type { PlanResult } from "./plan-wizard";
import { ReportsPanel } from "./reports-panel";

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: { accessToken: "owner-access-token" } }))
}));

vi.mock("next-auth/react", () => ({ useSession }));

const planResult: PlanResult = {
  plan_id: "plan-test",
  version: 1,
  summary: "Restaurant summary",
  sections: [{ title: "Operations", content: "Daily operations summary." }],
  markdown: "# Restaurant summary\n\n## Operations\n\nDaily operations summary.",
  calculations: {
    monthly_revenue: "100000",
    monthly_payroll: "20000",
    startup_capex: "30000",
    total_startup_cost: "30000",
    monthly_fixed_costs: "10000",
    monthly_variable_cost: "20000",
    monthly_operating_profit: "50000",
    annual_operating_profit: "600000",
    break_even_revenue: "25000",
    target_monthly_revenue: "50000",
    loan_first_payment: null,
    loan_total_payment: null,
    loan_total_interest: null,
    loan_term_months: null,
    annual_debt_service: null,
    dscr: null
  },
  assumptions: {
    locale: "en" as const,
    business_name: "Test restaurant",
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
    staff: [
      { role: "Cook", employee_count: 10, monthly_salary: "3000000" }
    ],
    equipment: [
      { name: "Equipment", quantity: "1", unit_cost: "50000000" }
    ],
    other_startup_cost: "10000000",
    loan_amount: "0",
    annual_interest_rate_percent: "0",
    loan_term_months: 0,
    target_monthly_profit: "10000000"
  }
};

const initialHistory = {
  current_version: 1,
  versions: [
    {
      version: 1,
      created_at: "2026-10-17T10:00:00+00:00",
      summary: planResult.summary,
      sections: planResult.sections,
      markdown: planResult.markdown
    }
  ],
  share_enabled: false
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useSession.mockReset();
  useSession.mockReturnValue({ data: { accessToken: "owner-access-token" } });
});

describe("reports panel", () => {
  it("offers all plan exports and shows a localized tier restriction", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(initialHistory))
      .mockResolvedValueOnce(
        Response.json(
          { detail: "documents.export_plan_required" },
          { status: 403 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <ReportsPanel onPlanUpdated={vi.fn()} planResult={planResult} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("button", { name: "Download PDF" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Download Excel" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Download bank pack" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Download Agent-Synergy" })
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Document exports are available on Pro and Business plans."
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/plan-test/pdf",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer owner-access-token"
        })
      })
    );
  });

  it("shows the generated Markdown as escaped text and saves an edited version", async () => {
    const updatedPlan = {
      ...planResult,
      version: 2,
      summary: "Updated restaurant summary",
      sections: [{ title: "Operations", content: "Updated operations summary." }],
      markdown:
        "# Updated restaurant summary\n\n## Operations\n\nUpdated operations summary."
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(initialHistory))
      .mockResolvedValueOnce(Response.json(updatedPlan));
    vi.stubGlobal("fetch", fetchMock);
    const onPlanUpdated = vi.fn();

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <ReportsPanel onPlanUpdated={onPlanUpdated} planResult={planResult} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText("Markdown version")).toBeDefined();
    expect(document.querySelector("pre")?.textContent).toBe(planResult.markdown);
    expect(screen.getByText("Version 1")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    fireEvent.change(screen.getByLabelText("Summary"), {
      target: { value: updatedPlan.summary }
    });
    fireEvent.change(screen.getByLabelText("Section content"), {
      target: { value: "Updated operations summary." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save revision" }));

    await waitFor(() => expect(onPlanUpdated).toHaveBeenCalledWith(updatedPlan));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plans/plan-test",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer owner-access-token"
        }),
        body: JSON.stringify({
          summary: "Updated restaurant summary",
          sections: [
            { title: "Operations", content: "Updated operations summary." }
          ]
        })
      })
    );
    expect(screen.getByText("Saved as version 2.")).toBeDefined();
  });

  it("restores a historical revision and duplicates the plan", async () => {
    const history = {
      current_version: 2,
      versions: [
        ...initialHistory.versions,
        {
          version: 2,
          created_at: "2026-10-17T11:00:00+00:00",
          summary: "Current revision",
          sections: [{ title: "Operations", content: "Current operation." }],
          markdown: "# Current revision"
        }
      ],
      share_enabled: false
    };
    const restoredPlan = { ...planResult, version: 3, summary: "Restored revision" };
    const duplicatedPlan = {
      ...restoredPlan,
      plan_id: "plan-copy",
      version: 1
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(history))
      .mockResolvedValueOnce(Response.json(restoredPlan))
      .mockResolvedValueOnce(Response.json(duplicatedPlan));
    vi.stubGlobal("fetch", fetchMock);
    const onPlanUpdated = vi.fn();

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <ReportsPanel onPlanUpdated={onPlanUpdated} planResult={planResult} />
      </NextIntlClientProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    await waitFor(() => expect(onPlanUpdated).toHaveBeenCalledWith(restoredPlan));
    expect(await screen.findByText("Restored version 1 as a new revision.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Duplicate plan" }));
    await waitFor(() => expect(onPlanUpdated).toHaveBeenCalledWith(duplicatedPlan));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plans/plan-test/duplicate",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("enables, displays, and revokes a read-only share link", async () => {
    const token = "x".repeat(43);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(initialHistory))
      .mockResolvedValueOnce(Response.json({ token }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <ReportsPanel onPlanUpdated={vi.fn()} planResult={planResult} />
      </NextIntlClientProvider>
    );

    const enableButton = await screen.findByRole("button", {
      name: "Enable read-only link"
    });
    await waitFor(() => expect((enableButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(enableButton);
    const shareLink = await screen.findByLabelText("Read-only share link");
    expect((shareLink as HTMLInputElement).value).toContain(`/en/shared/${token}`);

    fireEvent.click(screen.getByRole("button", { name: "Revoke share link" }));
    await waitFor(() =>
      expect(screen.getByText("The share link has been revoked.")).toBeDefined()
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/plans/plan-test/share",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
