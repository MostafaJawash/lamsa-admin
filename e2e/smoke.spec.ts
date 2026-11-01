import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/",
  "/products",
  "/categories",
  "/brands",
  "/orders",
  "/customers",
  "/banners",
  "/notifications",
  "/settings",
  "/no-such-page",
];

for (const route of PROTECTED_ROUTES) {
  test(`unauthenticated visit to ${route} redirects to /login`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test("login page renders right-to-left in Arabic", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(
    page.getByRole("heading", { name: "تسجيل الدخول" }),
  ).toBeVisible();
  await expect(page.getByLabel("رقم الهاتف")).toBeVisible();
});
