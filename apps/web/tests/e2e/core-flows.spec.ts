import { expect, test } from "@playwright/test";

import {
  installAuthenticatedSession,
  mockCredentialsSignIn
} from "./auth-fixture";

const generatedPlan = {
  plan_id: "e2e-plan",
  version: 1,
  summary: "A fictional E2E restaurant plan.",
  sections: [{ title: "Operations", content: "Fictional test narrative." }],
  markdown:
    "# A fictional E2E restaurant plan.\n\n## Operations\n\nFictional test narrative.",
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
    business_name: "E2E Cafe",
    restaurant_format: "family",
    location: "Tashkent",
    seats: 40,
    menu_summary: "Fictional test menu",
    average_check: "100000",
    daily_customers: 50,
    operating_days_per_month: 30,
    monthly_rent: "10000000",
    monthly_utilities: "1000000",
    variable_cost_ratio_percent: "30",
    staff: [{ role: "Cook", employee_count: 2, monthly_salary: "3000000" }],
    equipment: [{ name: "Equipment", quantity: "1", unit_cost: "50000000" }],
    other_startup_cost: "10000000",
    loan_amount: "0",
    annual_interest_rate_percent: "0",
    loan_term_months: 36,
    target_monthly_profit: "10000000"
  }
};

test("signup registers an account and completes credentials sign-in", async ({
  page
}) => {
  await mockCredentialsSignIn(page);
  let registration: Record<string, unknown> | undefined;
  await page.route("**/api/register", async (route) => {
    registration = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ message: "registered" })
    });
  });
  await page.goto("/en/signup");

  await page.locator("#signup-name").fill("Playwright Owner");
  await page.locator("#signup-email").fill("playwright@example.test");
  await page.locator("#signup-password").fill("TestPassword123!");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/en\/app(?:\/finadvisor)?$/);
  expect(registration).toMatchObject({
    name: "Playwright Owner",
    email: "playwright@example.test",
    role: "tadbirkor"
  });
});

test("login signs in and opens the protected business workspace", async ({
  page
}) => {
  await mockCredentialsSignIn(page);
  await page.goto("/en/login");

  await page.locator("#login-email").fill("playwright@example.test");
  await page.locator("#login-password").fill("TestPassword123!");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/en\/app\/finadvisor$/);
  await expect(
    page.getByRole("heading", { name: "Create a business plan" })
  ).toBeVisible();
});

test("creates a plan with a fake AI stream and downloads the PDF export", async ({
  page
}) => {
  await installAuthenticatedSession(page);
  let planRequest: Record<string, unknown> | undefined;
  await page.route("**/api/plans/generate-and-save/stream", async (route) => {
    planRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        'event: progress\ndata: {"phase":"calculating","chunks":0}\n\n',
        `event: complete\ndata: ${JSON.stringify(generatedPlan)}\n\n`
      ].join("")
    });
  });
  await page.route("**/api/plans/e2e-plan/versions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        current_version: 1,
        versions: [
          {
            version: 1,
            created_at: "2026-01-01T00:00:00Z",
            summary: generatedPlan.summary,
            sections: generatedPlan.sections,
            markdown: generatedPlan.markdown
          }
        ],
        share_enabled: false
      })
    });
  });
  await page.route("**/api/documents/e2e-plan/pdf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "%PDF-1.4 fake E2E document"
    });
  });

  await page.goto("/en/app/finadvisor");
  await page.waitForFunction(() =>
    window.localStorage.getItem("finadvisor.restaurant-plan-draft")
  );
  await page.getByLabel("Restaurant name").fill("E2E Cafe");
  await page.getByLabel("Address or area").fill("Tashkent");
  await page.getByLabel("Number of seats").fill("40");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "2"
  );
  await page.getByLabel("Brief menu description").fill("Fictional test menu");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "3"
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "4"
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "5"
  );
  await page.getByRole("button", { name: "Generate plan" }).click();

  await expect(
    page.getByText(generatedPlan.summary, { exact: true }).first()
  ).toBeVisible();
  expect(planRequest).toMatchObject({
    business_name: "E2E Cafe",
    location: "Tashkent",
    menu_summary: "Fictional test menu"
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("finadvisor-plan-e2e-plan.pdf");
});
