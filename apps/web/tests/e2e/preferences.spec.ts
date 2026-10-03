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
