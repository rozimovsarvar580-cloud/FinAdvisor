import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: { accessToken: "owner-access-token" } }))
}));

vi.mock("next-auth/react", () => ({ useSession }));

import { PlanWizard } from "./plan-wizard";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  useSession.mockReset();
  useSession.mockReturnValue({ data: { accessToken: "owner-access-token" } });
});

describe("plan wizard streaming generation", () => {
  it("restores a saved draft from local storage", async () => {
    window.localStorage.setItem(
      "finadvisor.restaurant-plan-draft",
      JSON.stringify({
        step: 0,
        values: {
          businessName: "Restored restaurant",
          restaurantFormat: "family",
          location: "Tashkent",
          seats: "55",
          menuSummary: "Local dishes",
          averageCheck: "100000",
          dailyCustomers: "60",
          operatingDays: "28",
          rent: "10000000",
          utilities: "1000000",
          variableCostPercent: "30",
          cookCount: "5",
          cookSalary: "3000000",
          serverCount: "8",
          serverSalary: "2000000",
          equipmentCost: "50000000",
          otherStartupCost: "10000000",
          loanAmount: "0",
          loanRate: "0",
          loanTermMonths: "36",
          targetProfit: "10000000"
        }
      })
    );

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <PlanWizard onGenerated={vi.fn()} />
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Restaurant name")).toHaveProperty(
        "value",
        "Restored restaurant"
      );
      expect(screen.getByLabelText("Number of seats")).toHaveProperty(
        "value",
        "55"
      );
    });
  });

  it("forwards authenticated plan input and parses the completed JSON/Markdown result", async () => {
    const result = {
      plan_id: "plan-streamed",
      version: 1,
      summary: "A concise business plan.",
      sections: [{ title: "Operations", content: "Plan narrative." }],
      markdown: "# A concise business plan.\n\n## Operations\n\nPlan narrative.",
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
        locale: "en",
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
    const streamContent = [
      'event: progress\ndata: {"phase":"calculating","chunks":0}\n\n',
      'event: progress\ndata: {"phase":"writing","chunks":1}\n\n',
      `event: complete\ndata: ${JSON.stringify(result)}\n\n`
    ].join("");
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(streamContent));
        controller.close();
      }
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const onGenerated = vi.fn();

    const { container } = render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <PlanWizard onGenerated={onGenerated} />
      </NextIntlClientProvider>
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("Plan wizard form is required");
    fireEvent.submit(form);

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith(result));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plans/generate-and-save/stream",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer owner-access-token"
        })
      })
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
