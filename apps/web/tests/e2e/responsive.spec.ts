import { expect, test, type Page } from "@playwright/test";

import { installAuthenticatedSession } from "./auth-fixture";

const locales = ["uz", "ru", "en"] as const;
const themes = ["light", "dark"] as const;
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 }
] as const;
const pages = [
  { name: "landing", path: "" },
  { name: "pricing", path: "/pricing" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "workspace", path: "/app/finadvisor" }
] as const;

async function findResponsiveLayoutIssues(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const horizontalOverflow =
      Math.max(root.scrollWidth, document.body.scrollWidth) >
      root.clientWidth + 1;
    const overflowElements = Array.from(
      document.querySelectorAll<HTMLElement>("body *")
    )
      .filter(
        (element) =>
          element.getClientRects().length > 0 &&
          element.getBoundingClientRect().right > root.clientWidth + 1
      )
      .slice(0, 10)
      .map((element) => ({
        element: element.tagName.toLowerCase(),
        className: String(element.className).slice(0, 100),
        text: element.innerText.trim().slice(0, 100),
        href: element.getAttribute("href"),
        left: Math.round(element.getBoundingClientRect().left),
        width: Math.round(element.getBoundingClientRect().width),
        fontSize: window.getComputedStyle(element).fontSize,
        whiteSpace: window.getComputedStyle(element).whiteSpace,
        ancestors: [element.parentElement, element.parentElement?.parentElement]
          .filter((ancestor): ancestor is HTMLElement => Boolean(ancestor))
          .map((ancestor) => {
            const rect = ancestor.getBoundingClientRect();
            return {
              element: ancestor.tagName.toLowerCase(),
              className: String(ancestor.className).slice(0, 80),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              display: window.getComputedStyle(ancestor).display
            };
          }),
        right: Math.round(element.getBoundingClientRect().right)
      }));
    const textElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        "h1,h2,h3,h4,h5,h6,p,a,button,label,input,textarea,select,li,[role='tab']"
      )
    ).filter(
      (element) =>
        element.getClientRects().length > 0 &&
        (element.innerText?.trim() ||
          ("value" in element && Boolean(element.value)))
    );
    const clippedText = textElements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const ownOverflow =
        (["hidden", "clip"].includes(style.overflowX) &&
          element.scrollWidth > element.clientWidth + 1) ||
        (["hidden", "clip"].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1);
      let clippedByAncestor = false;

      for (
        let ancestor = element.parentElement;
        ancestor && ancestor !== document.body;
        ancestor = ancestor.parentElement
      ) {
        const ancestorStyle = window.getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        const clipsX = ["hidden", "clip"].includes(ancestorStyle.overflowX);
        const clipsY = ["hidden", "clip"].includes(ancestorStyle.overflowY);

        if (
          (clipsX &&
            (rect.left < ancestorRect.left - 1 ||
              rect.right > ancestorRect.right + 1)) ||
          (clipsY &&
            (rect.top < ancestorRect.top - 1 ||
              rect.bottom > ancestorRect.bottom + 1))
        ) {
          clippedByAncestor = true;
          break;
        }
      }

      return ownOverflow || clippedByAncestor
        ? [
            {
              element: element.tagName.toLowerCase(),
              text: element.innerText?.trim().slice(0, 60) ?? ""
            }
          ]
        : [];
    });

    return {
      horizontalOverflow,
      clippedText,
      overflowElements,
      viewportWidth: root.clientWidth,
      documentWidth: root.scrollWidth
    };
  });
}

test("main pages fit supported locales, themes, and viewport widths", async ({
  page
}, testInfo) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAuthenticatedSession(page);

  let navigationCount = 0;
  for (const locale of locales) {
    for (const theme of themes) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        for (const route of pages) {
          await page.setExtraHTTPHeaders({
            "x-forwarded-for": `198.51.100.${navigationCount + 1}`
          });
          navigationCount += 1;
          await page.goto(`/${locale}${route.path}`, {
            waitUntil: "domcontentloaded"
          });
          await expect(page.locator("main")).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect
            .poll(() =>
              page.locator("html").evaluate((element) =>
                element.classList.contains("dark")
              )
            )
            .toBe(theme === "dark");

          await page.evaluate(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            window.scrollTo(0, 0);
          });
          const issues = await findResponsiveLayoutIssues(page);
          const context = `${route.name}, ${locale}, ${theme}, ${viewport.width}px`;
          expect(
            issues.horizontalOverflow,
            `${context}: horizontal overflow ${JSON.stringify(issues.overflowElements)}`
          ).toBe(false);
          expect(issues.clippedText, `${context}: clipped text`).toEqual([]);

          await page.screenshot({
            path: testInfo.outputPath(
              `responsive/${locale}-${theme}-${viewport.width}-${route.name}.jpg`
            ),
            type: "jpeg",
            quality: 60,
            fullPage: true,
            animations: "disabled"
          });

          if (route.name === "workspace" && viewport.width < 1024) {
            const menuToggle = page.getByTestId("app-menu-toggle");
            await expect(menuToggle).toBeVisible();
            await expect(page.locator("#app-sidebar")).toBeHidden();
            await menuToggle.click();
            await expect(page.locator("#app-sidebar")).toBeVisible();
            const openMenuIssues = await findResponsiveLayoutIssues(page);
            expect(
              openMenuIssues.horizontalOverflow,
              `${context}: open menu horizontal overflow`
            ).toBe(false);
            expect(
              openMenuIssues.clippedText,
              `${context}: open menu clipped text`
            ).toEqual([]);
            await page.screenshot({
              path: testInfo.outputPath(
                `responsive/${locale}-${theme}-${viewport.width}-workspace-menu.jpg`
              ),
              type: "jpeg",
              quality: 60,
              fullPage: true,
              animations: "disabled"
            });
          }
        }
      }
    }
  }
});
