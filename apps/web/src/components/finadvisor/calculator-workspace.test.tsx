import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn(() => ({
    data: {
      accessToken: "calculator-owner-token",
      user: { role: "tadbirkor" }
    },
    status: "authenticated"
  }))
}));

vi.mock("next-auth/react", () => ({ useSession }));

import { CalculatorWorkspace } from "./calculator-workspace";

function renderCalculator(calculatorType: Parameters<typeof CalculatorWorkspace>[0]["calculatorType"]) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <CalculatorWorkspace calculatorType={calculatorType} />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  useSession.mockReset();
  useSession.mockReturnValue({
    data: {
      accessToken: "calculator-owner-token",
      user: { role: "tadbirkor" }
    },
    status: "authenticated"
  });
});

describe("calculator workspace", () => {
  it("calculates startup costs through the API and displays a chart", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/plans/mine") {
        return Promise.resolve(Response.json({ items: [] }));
      }
      return Promise.resolve(Response.json({
        calculation_type: "startup-cost",
        result: {
          items: [],
          category_totals: { rent_deposit: "1000.00" },
          total_cost: "1000.00"
        },
        explanation: {
          formula: "item_total = quantity * unit_cost",
          inputs: { item_count: "1" }
        }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderCalculator("startup-cost");

    fireEvent.change(screen.getByRole("textbox", { name: "Item name" }), {
      target: { value: "Rent deposit" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity" }), {
      target: { value: "1" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Unit cost (UZS)" }), {
      target: { value: "1000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect((await screen.findAllByText("1000.00")).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Result chart" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calc/startup-cost",
      expect.objectContaining({
        body: JSON.stringify({
          items: [
            {
              category: "rent_deposit",
              name: "Rent deposit",
              quantity: "1",
              unit_cost: "1000"
            }
          ]
        })
      })
    );
  });

  it("saves a recalculated result to a selected business plan", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/plans/mine") {
        return Promise.resolve(
          Response.json({
            items: [
              {
                id: "plan-owned",
                business_name: "My restaurant",
                location: "Tashkent"
              }
            ]
          })
        );
      }
      if (url === "/api/calc/loan-affordability") {
        return Promise.resolve(
          Response.json({
            calculation_type: "loan-affordability",
            result: {
              affordable: true,
              monthly_available_cash: "1000",
              maximum_monthly_payment: "88.85",
              minimum_monthly_surplus: "911.15",
              schedule: {
                method: "annuity",
                principal: "1000",
                annual_interest_rate_percent: "12",
                term_months: 12,
                first_payment: "88.85",
                total_payment: "1066.20",
                total_interest: "66.20",
                payments: [
                  {
                    month: 1,
                    payment: "88.85",
                    principal: "78.85",
                    interest: "10.00",
                    remaining_balance: "921.15"
                  }
                ]
              }
            },
            explanation: {
              formula: "affordable = monthly_available_cash >= every scheduled payment",
              inputs: { maximum_monthly_payment: "93.33" }
            }
          })
        );
      }
      return Promise.resolve(Response.json({ plan_id: "plan-owned", result: {} }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderCalculator("loan");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Loan principal (UZS)" }), {
      target: { value: "1000" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Annual interest rate (%)" }), {
      target: { value: "12" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Term (months)" }), {
      target: { value: "12" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Available monthly cash (UZS)" }), {
      target: { value: "1000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByText("All scheduled payments fit within the available monthly cash.")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save result to a business plan" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Save result to a business plan" }));

    expect(await screen.findByText("Calculation saved to your plan.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plans/plan-owned/calculations",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer calculator-owner-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          calculation_type: "loan-affordability",
          inputs: {
            method: "annuity",
            monthly_available_cash: "1000",
            principal: "1000",
            annual_interest_rate_percent: "12",
            term_months: 12
          }
        })
      })
    );
  });

  it("marks tax amounts as estimates when rules have not been verified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url === "/api/plans/mine") {
        return Promise.resolve(Response.json({ items: [] }));
      }
      return Promise.resolve(Response.json({
          calculation_type: "tax-comparison",
          result: {
            annual_revenue: "100000",
            annual_expenses: "50000",
            pretax_profit: "50000",
            regimes: [
              {
                regime: "turnover",
                taxable_base: "100000",
                rate: "4",
                tax_amount: "4000",
                profit_after_tax: "46000",
                source_article: "Article",
                source_name: "Tax Code",
                source_url: "https://example.test/source",
                effective_from: "2026-01-01",
                published_at: "2026-01-01",
                eligibility_note: "Eligibility may vary.",
                verified: false,
                verified_by: null
              }
            ]
          },
          explanation: { formula: "provided by engine", inputs: {} }
        }));
    }));
    renderCalculator("tax");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Annual revenue (UZS)" }), {
      target: { value: "100000" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Annual expenses (UZS)" }), {
      target: { value: "50000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByText("Estimate: Not verified")).toBeTruthy();
    expect(screen.getByRole("link", { name: "https://example.test/source" })).toBeTruthy();
  });

  it("does not display an unverified payroll contribution as zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url === "/api/plans/mine") {
        return Promise.resolve(Response.json({ items: [] }));
      }
      return Promise.resolve(Response.json({
        calculation_type: "payroll",
        result: {
          employee_count: 2,
          monthly_payroll: "200.00",
          annual_payroll: "2400.00",
          employer_contributions: [
            {
              key: "employer_social_contribution",
              rate: null,
              monthly_amount: null,
              annual_amount: null,
              source_url: "TODO(VERIFY)",
              effective_date: "2026-01-01",
              verified: false
            }
          ],
          monthly_employer_contributions: null,
          annual_employer_contributions: null,
          monthly_total_employer_cost: null,
          annual_total_employer_cost: null,
          contributions_complete: false,
          contributions_verified: false,
          positions: [
            {
              role: "Cook",
              employee_count: 2,
              monthly_salary: "100",
              monthly_payroll: "200.00"
            }
          ]
        },
        explanation: { formula: "engine formula", inputs: {} }
      }));
    }));
    renderCalculator("payroll");

    fireEvent.change(screen.getByRole("textbox", { name: "Role" }), {
      target: { value: "Cook" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Number of employees" }), {
      target: { value: "2" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Monthly salary (UZS)" }), {
      target: { value: "100" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByText("Monthly payroll")).toBeTruthy();
    expect(await screen.findByText(
      "Employer contribution totals are unavailable until the rate is verified."
    )).toBeTruthy();
  });

  it("shows revenue projections, break-even and a visual period comparison", async () => {
    const period = {
      operating_days: 26,
      revenue: "26000.00",
      variable_costs: "10400.00",
      fixed_costs: "5000.00",
      operating_profit: "10600.00"
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url === "/api/plans/mine") {
        return Promise.resolve(Response.json({ items: [] }));
      }
      return Promise.resolve(Response.json({
        calculation_type: "revenue-projection",
        result: {
          daily: { ...period, operating_days: 1, revenue: "1000.00" },
          weekly: { ...period, operating_days: 6, revenue: "6000.00" },
          monthly: period,
          yearly: { ...period, operating_days: 312, revenue: "312000.00" },
          break_even_revenue_monthly: "8333.333333333333333333333333",
          target_revenue_monthly: "25000",
          sensitivity: []
        },
        explanation: { formula: "engine formula", inputs: {} }
      }));
    }));
    renderCalculator("profit");

    for (const [label, value] of [
      ["Daily revenue (UZS)", "1000"],
      ["Monthly fixed costs (UZS)", "5000"],
      ["Variable costs (%)", "40"],
      ["Operating days per week", "6"],
      ["Operating days per month", "26"],
      ["Operating days per year", "312"],
      ["Target monthly profit (UZS)", "10000"]
    ]) {
      fireEvent.change(screen.getByRole("spinbutton", { name: label }), {
        target: { value }
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByText("Monthly break-even revenue")).toBeTruthy();
    expect(screen.getByText("8333.333333333333333333333333")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Result chart" })).toBeTruthy();
  });
});
