import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import { SharedPlanView } from "./shared-plan-view";

afterEach(() => {
  vi.unstubAllGlobals();
});

const sharedPlan = {
  plan_id: "plan-shared",
  business_name: "Shared restaurant",
  location: "Tashkent",
  created_at: "2026-10-17T10:00:00+00:00",
  plan: {
    summary: "Read-only summary",
    sections: [{ title: "Operations", content: "Daily service." }],
    markdown: "# Read-only summary",
    calculations: {
      monthly_revenue: "150000000",
      monthly_payroll: "70000000",
      startup_capex: "50000000",
      total_startup_cost: "60000000",
      monthly_fixed_costs: "81000000",
      monthly_variable_cost: "45000000",
      monthly_operating_profit: "24000000",
      annual_operating_profit: "288000000",
      break_even_revenue: "115714285.71",
      target_monthly_revenue: "130000000",
      loan_first_payment: null,
      loan_total_payment: null,
      loan_total_interest: null,
      loan_term_months: null,
      annual_debt_service: null,
      dscr: null
    },
    assumptions: {
      locale: "en",
      business_name: "Shared restaurant",
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
      staff: [],
      equipment: [],
      other_startup_cost: "10000000",
      loan_amount: "0",
      annual_interest_rate_percent: "0",
      loan_term_months: 0,
      target_monthly_profit: "10000000"
    }
  }
};

function renderSharedPlan() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <SharedPlanView token={"s".repeat(43)} />
    </NextIntlClientProvider>
  );
}

describe("shared plan view", () => {
  it("shows shared plan content without edit controls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(sharedPlan)));

    renderSharedPlan();

    expect(await screen.findByText("Shared restaurant")).toBeDefined();
    expect(screen.getByText("Read-only summary")).toBeDefined();
    expect(screen.getByText("Daily service.")).toBeDefined();
    expect(screen.getByText("Read-only access")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains that a revoked share link is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ detail: "plans.shared_plan_not_found" }, { status: 404 }))
    );

    renderSharedPlan();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "This shared plan is unavailable or its link has been revoked."
      )
    );
  });
});
