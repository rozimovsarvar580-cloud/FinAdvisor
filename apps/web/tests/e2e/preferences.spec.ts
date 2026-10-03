import { expect, test } from "@playwright/test";

test("locale switch keeps the current route and stores the choice", async ({
  page
}) => {
  await page.goto("/uz");
  await page.getByRole("combobox", { name: "Til" }).selectOption("en");

  await expect(page).toHaveURL(/\/en$/);
  await expect(
    page.getByRole("heading", {
      name: "Clear financial decisions for your business"
    })
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Language" })).toHaveValue(
    "en"
  );
  await expect.poll(() => page.context().cookies()).toContainEqual(
    expect.objectContaining({ name: "NEXT_LOCALE", value: "en" })
  );
});

test("theme control switches between dark and light without a flash", async ({
  page
}) => {
  await page.goto("/en");
  const toggle = page.getByTestId("theme-toggle");

  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});
