import { expect, test } from "@playwright/test";

import { installAuthenticatedSession } from "./auth-fixture";

test("free AI limit leads through fake checkout to Pro and cancellation", async ({
  page
}) => {
  await installAuthenticatedSession(page);

  let hasPaid = false;
  let cancellationRequested = false;
  let checkoutRequest: Record<string, unknown> | undefined;
  await page.route("**/api/plans/analyze", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ detail: "ai.daily_limit_reached" })
    });
  });
  await page.route("**/api/billing/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        hasPaid
          ? {
              current_plan: "pro",
              status: "active",
              billing_period: "weekly",
              price: "10.00",
              currency: "USD",
              next_charge_at: "2026-12-01T00:00:00Z",
              access_until: cancellationRequested
                ? "2026-12-01T00:00:00Z"
                : null,
              cancel_at_period_end: cancellationRequested,
              pending_plan: null,
              pending_plan_effective_at: null,
              payment_method_available: true,
              invoices: []
            }
          : {
              current_plan: "free",
              status: "inactive",
              billing_period: null,
              price: null,
              currency: null,
              next_charge_at: null,
              access_until: null,
              cancel_at_period_end: false,
              pending_plan: null,
              pending_plan_effective_at: null,
              payment_method_available: false,
              invoices: []
            }
      )
    });
  });
  await page.route("**/api/billing/checkout", async (route) => {
    checkoutRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        checkout_url: "https://fake-checkout.finadvisor.test/session-e2e"
      })
    });
  });
  await page.route("**/api/billing/cancel", async (route) => {
    cancellationRequested = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cancel_at_period_end: true,
        access_until: "2026-12-01T00:00:00Z"
      })
    });
  });
  await page.route("https://fake-checkout.finadvisor.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `
        <main>
          <h1>Fake payment provider</h1>
          <a href="http://127.0.0.1:3000/mock-payment-complete">Complete test payment</a>
        </main>
      `
    });
  });
  await page.route("http://127.0.0.1:3000/mock-payment-complete", async (route) => {
    hasPaid = true;
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `
        <main>
          <h1>Payment confirmed</h1>
          <a href="http://127.0.0.1:3000/en/app/billing?checkout=success">Return to FinAdvisor</a>
        </main>
      `
    });
  });

  await page.goto("/en/app/finadvisor");
  await page.getByRole("tab", { name: "Plan analyzer" }).click();
  await page.locator("#plan-document").setInputFiles({
    name: "free-plan.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Fictional test business plan")
  });
  await page.getByRole("button", { name: "Analyze plan" }).click();
  await expect(page.locator("p[role='alert']")).toContainText(
    "Your daily AI request limit has been reached"
  );
  await page.getByRole("link", { name: "Upgrade to Pro" }).click();

  await expect(page).toHaveURL(/\/en\/app\/billing\?plan=pro&period=weekly$/);
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Fake payment provider" })).toBeVisible();
  expect(checkoutRequest).toMatchObject({
    plan: "pro",
    billing_period: "weekly",
    locale: "en"
  });

  await page.getByRole("link", { name: "Complete test payment" }).click();
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
  await page.getByRole("link", { name: "Return to FinAdvisor" }).click();
  await expect(page).toHaveURL(/\/en\/app\/billing\?checkout=success$/);
  await expect(
    page.locator("dl").getByText("Pro", { exact: true })
  ).toBeVisible();
  await expect(
    page.locator("dl").getByText("Active", { exact: true })
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel at period end" }).click();
  await expect(
    page.getByText(
      "Your subscription remains active until the paid period ends."
    )
  ).toBeVisible();
  await expect(
    page.locator("dl").getByText("Pro", { exact: true })
  ).toBeVisible();
  await expect(
    page.locator("dl").getByText("Active", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Access through")).toBeVisible();
});
