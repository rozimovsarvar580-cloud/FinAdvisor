import axe from "axe-core";
import { expect, test, type Page } from "@playwright/test";

import { installAuthenticatedSession } from "./auth-session";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

const publicPages = [
  {
    name: "landing",
    path: "/en",
    heading: "Run your business with confidence and clear numbers"
  },
  {
    name: "pricing",
    path: "/en/pricing",
    heading: "Planning tools that fit your business"
  },
  {
    name: "login",
    path: "/en/login",
    heading: "Log in to your account"
  },
  { name: "signup", path: "/en/signup", heading: "Create an account" }
];

async function openAccessiblePage(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
}

for (const { name, path, heading } of publicPages) {
  test(`${name} page has no serious accessibility violations`, async ({
    page
  }) => {
    await openAccessiblePage(page, path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await page.addScriptTag({ content: axe.source });

    const violations = await page.evaluate(async () => {
      const results = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
        }
      });
      return results.violations.filter(
        (violation) =>
          violation.impact === "critical" || violation.impact === "serious"
      );
    });

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}

test("wizard has no serious accessibility violations", async ({ page }) => {
  await installAuthenticatedSession(page);
  await openAccessiblePage(page, "/en/app/finadvisor");
  await expect(page.getByRole("tab").first()).toBeVisible();
  await page.addScriptTag({ content: axe.source });

  const violations = await page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
      }
    });
    return results.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    );
  });

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test("signup controls follow a logical keyboard focus order", async ({
  page
}) => {
  await openAccessiblePage(page, "/en/signup");
  const name = page.locator("#signup-name");
  const email = page.getByLabel("Email");
  const password = page.locator("#signup-password");
  const passwordVisibility = password.locator("xpath=..").getByRole("button");
  const role = page.getByLabel("Account type");
  const consent = page.locator('input[type="checkbox"]');

  await name.focus();
  await page.keyboard.press("Tab");
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passwordVisibility).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(role).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(consent).toBeFocused();
});

test("workspace tabs support vertical arrow-key navigation", async ({
  page
}) => {
  await installAuthenticatedSession(page);
  await openAccessiblePage(page, "/en/app/finadvisor");
  const tabs = page.getByRole("tab");
  const firstTab = tabs.nth(0);
  const secondTab = tabs.nth(1);

  await firstTab.focus();
  await page.keyboard.press("ArrowDown");
  await expect(secondTab).toBeFocused();
  await expect(secondTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowUp");
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");
});
