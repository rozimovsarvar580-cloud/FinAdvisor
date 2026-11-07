import axe from "axe-core";
import { expect, test, type Page } from "@playwright/test";

import { installAuthenticatedSession } from "./auth-fixture";

interface AxeViolation {
  id: string;
  help: string;
  impact: string | null;
  nodes: Array<{ failureSummary?: string; html: string; target: string[] }>;
}

interface AxeFinding {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{
    failureSummary?: string;
    html: string;
    target: string[];
  }>;
  page: string;
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
): Promise<AxeFinding[]> {
  await page.evaluate(async () => {
    const activeAnimations = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY
      );
    await Promise.all(
      activeAnimations.map((animation) =>
        animation.finished.catch(() => undefined)
      )
    );
  });
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
          failureSummary: node.failureSummary,
          html: node.html
        }))
      }));
  });

  return violations.map((violation) => ({ ...violation, page: pageName }));
}

test("landing, pricing, login, signup, and wizard have no serious axe violations", async ({
  page
}) => {
  const findings: AxeFinding[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/en", "/en/pricing", "/en/login", "/en/signup"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    findings.push(...(await expectNoSeriousAxeViolations(page, route)));
  }

  await installAuthenticatedSession(page);
  await page.goto("/en/app/finadvisor");
  await expect(
    page.getByRole("heading", { name: "Create a business plan" })
  ).toBeVisible();
  findings.push(
    ...(await expectNoSeriousAxeViolations(page, "/en/app/finadvisor"))
  );
  expect(findings, "Target pages have serious axe violations").toEqual([]);
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

test("workspace tabs support vertical arrow and boundary-key navigation", async ({
  page
}) => {
  await installAuthenticatedSession(page);
  await page.goto("/en/app/finadvisor");

  const tabs = page.getByRole("tab");
  const firstTab = tabs.first();
  const secondTab = tabs.nth(1);
  const lastTab = tabs.last();

  await firstTab.focus();
  await page.keyboard.press("ArrowDown");
  await expect(secondTab).toBeFocused();
  await expect(secondTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowUp");
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(lastTab).toBeFocused();
  await expect(lastTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Home");
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");
});
