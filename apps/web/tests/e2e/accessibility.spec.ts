import axe from "axe-core";
import { expect, test, type Page } from "@playwright/test";

import { installAuthenticatedSession } from "./auth-fixture";

interface AxeViolation {
  id: string;
  help: string;
  impact: string | null;
  nodes: Array<{ failureSummary?: string; target: string[] }>;
}

declare global {
  interface Window {
    axe: {
      run: (context: Document) => Promise<{ violations: AxeViolation[] }>;
    };
  }
}

async function expectNoSeriousAxeViolations(
  page: Page,
  pageName: string
): Promise<void> {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const results = await window.axe.run(document);
    return results.violations
      .filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical"
      )
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary
        }))
      }));
  });

  expect(violations, `${pageName} has serious axe violations`).toEqual([]);
}

test("landing, pricing, login, signup, and wizard have no serious axe violations", async ({
  page
}) => {
  for (const route of ["/en", "/en/pricing", "/en/login", "/en/signup"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expectNoSeriousAxeViolations(page, route);
  }

  await installAuthenticatedSession(page);
  await page.goto("/en/app/finadvisor");
  await expect(
    page.getByRole("heading", { name: "Create a business plan" })
  ).toBeVisible();
  await expectNoSeriousAxeViolations(page, "/en/app/finadvisor");
});

test("signup controls follow a predictable keyboard focus order", async ({
  page
}) => {
  await page.goto("/en/signup");
  const focusOrder = [
    "#signup-email",
    "#signup-password",
    'button[aria-label="Show password"]',
    "#signup-role",
    'form input[type="checkbox"]',
    'form a[href$="/terms"]',
    'form a[href$="/privacy"]',
    'form button[type="submit"]'
  ];

  await page.locator("#signup-name").focus();
  for (const selector of focusOrder) {
    await page.keyboard.press("Tab");
    await expect(page.locator(selector)).toBeFocused();
  }
});
