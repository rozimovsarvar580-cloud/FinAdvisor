import { expect, test } from "@playwright/test";

test("locale switch keeps the current route and stores the choice", async ({
  page
}) => {
  await page.goto("/uz");
  await page.getByRole("combobox", { name: "Til" }).selectOption("en");

  await expect(page).toHaveURL(/\/en$/);
  await expect(
    page.getByRole("heading", {
      name: "Run your business with confidence and clear numbers"
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

test("auth pages translate and protected paths preserve the callback URL", async ({
  page
}) => {
  await page.goto("/en/app/plan?from=wizard");

  await expect(page).toHaveURL(
    /\/en\/login\?callbackUrl=.*%2Fen%2Fapp%2Fplan/
  );
  await expect(
    page.getByRole("heading", { name: "Log in to your account" })
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();

  await page.goto("/ru/signup");
  await expect(
    page.getByRole("heading", { name: "Создайте аккаунт" })
  ).toBeVisible();
  await expect(page.getByLabel("Тип аккаунта")).toBeVisible();
  await expect(page.getByText("Принимаю условия использования и политику конфиденциальности")).toBeVisible();
});

test("landing page shows the key sections and an accessible FAQ accordion", async ({
  page
}) => {
  await page.goto("/uz");

  await expect(
    page.getByRole("heading", {
      name: "Biznesingizni raqamlar bilan ishonchli boshqaring"
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Yaxshi g‘oya aniq reja bilan boshlanadi" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Biznes rejangiz uchun kerakli vositalar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ko‘p beriladigan savollar" })).toBeVisible();

  await page.getByRole("button", { name: "Namuna PDF'ni ko‘rish" }).click();
  await expect(
    page.getByRole("dialog", { name: "Biznes-reja namunasi" })
  ).toBeVisible();
  await expect(
    page.getByText("Moliyaviy reja va hisoblar", { exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const question = page.getByRole("button", {
    name: "FinAdvisor kimlar uchun mo‘ljallangan?"
  });
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText(/O‘zbekistonda kichik biznes boshlayotgan/)
  ).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("link", { name: "Reja tuzishni boshlash" }).first()).toBeVisible();
});

test("about page explains the product and switches audience tabs", async ({
  page
}) => {
  await page.goto("/ru/about");

  await expect(
    page.getByRole("heading", { name: "Почему FinAdvisor?" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "FinAdvisor и универсальный AI" })
  ).toBeVisible();
  await expect(
    page.getByText("AI может ошибаться, а бизнес-план не гарантирует кредит, прибыль или возврат инвестиций.")
  ).toBeVisible();

  await page.getByRole("tab", { name: "Бухгалтер" }).click();
  await expect(
    page.getByRole("heading", { name: "Структурируйте финансы проекта клиента" })
  ).toBeVisible();
});

test("pricing periods update, commission uses the API, and guest selects Pro", async ({
  page
}) => {
  await page.route("**/api/pricing/commission", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        annual_revenue: "1100000000",
        total_commission: "23000000.00",
        bands: [
          {
            tier: "first_100m",
            revenue_portion: "100000000",
            rate_percent: "4.00",
            commission: "4000000.00"
          },
          {
            tier: "next_900m",
            revenue_portion: "900000000",
            rate_percent: "2.00",
            commission: "18000000.00"
          },
          {
            tier: "above_1b",
            revenue_portion: "100000000",
            rate_percent: "1.00",
            commission: "1000000.00"
          }
        ]
      })
    });
  });
  await page.goto("/uz/pricing");

  await expect(page.getByText("$10", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Oylik" }).click();
  await expect(page.getByText("$40", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yillik" }).click();
  await expect(page.getByText("$480", { exact: true })).toBeVisible();

  await page.getByLabel("Yillik tushum").fill("1100000000");
  await page.getByRole("button", { name: "Komissiyani hisoblash" }).click();
  await expect(page.getByText(/23000000\.00/)).toBeVisible();

  await page.getByRole("button", { name: "Tanlash" }).nth(1).click();
  await expect(page).toHaveURL(/\/uz\/signup\?plan=pro$/);
});
