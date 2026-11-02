import { expect, test, type Page } from "@playwright/test";

import {
  call,
  deleteBannersByPrefix,
  deleteCatalogByPrefix,
  deleteProductsByPrefix,
  loginViaApi,
  makePng,
  uploadProductImage,
} from "./support/backend.ts";

/**
 * Banners against the REAL backend (lamsa_test on :8001): create one linked to a real product
 * (made through the API first, active and with an image so the storefront would show it),
 * check the readable link text, edit its link, toggle it, delete it. Everything is named
 * "e2e-…" and swept by afterAll and global-teardown.
 */
const phone = () => process.env.E2E_ADMIN_PHONE as string;
const password = () => process.env.E2E_ADMIN_PASSWORD as string;
test.beforeEach(() =>
  test.skip(!process.env.E2E_ADMIN_PHONE, "backend on :8001 is not running"),
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const productName = `e2e-ban-منتج-${stamp}`;
const bannerTitle = `e2e-banner-${stamp}`;
const editedTitle = `${bannerTitle}-معدل`;
let adminToken = "";

test.beforeAll(async () => {
  if (!process.env.E2E_ADMIN_PHONE) return;
  adminToken = (await loginViaApi(phone(), password())).access_token;
  const category = await call<{ id: number }>("POST", "/admin/categories", {
    token: adminToken,
    body: { name: `e2e-ban-قسم-${stamp}` },
  });
  const product = await call<{ id: number }>("POST", "/admin/products", {
    token: adminToken,
    body: {
      type: "simple",
      currency: "SYP",
      name: productName,
      category_id: category.id,
      price: "10000",
      stock: 10,
    },
  });
  await uploadProductImage(adminToken, product.id);
  await call("PATCH", `/admin/products/${product.id}`, {
    token: adminToken,
    body: { is_active: true },
  });
});

test.afterAll(async () => {
  if (!adminToken) return;
  await deleteBannersByPrefix(adminToken, "e2e-");
  await deleteProductsByPrefix(adminToken, "e2e-");
  await deleteCatalogByPrefix(adminToken, "e2e-");
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("رقم الهاتف").fill(phone());
  await page.getByLabel("كلمة المرور").fill(password());
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("banner: create linked to a product, edit its link, toggle, delete", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("link", { name: "البانرات", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "البانرات", exact: true }),
  ).toBeVisible();

  // create: image, title, subtitle, link type product + the product from the picker
  await page.getByRole("button", { name: "إضافة بانر" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("image-input").setInputFiles({
    name: "banner.png",
    mimeType: "image/png",
    buffer: makePng(64),
  });
  await dialog.getByLabel(/^العنوان \*/).fill(bannerTitle);
  await dialog.getByLabel("العنوان الفرعي").fill("عرض خاص");
  await dialog.getByRole("combobox", { name: "وجهة الرابط" }).click();
  await page.getByRole("option", { name: "منتج", exact: true }).click();
  await dialog.getByRole("button", { name: new RegExp(productName) }).click();
  await expect(
    dialog.getByTestId("banner-link-product-selected"),
  ).toContainText(productName);
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();

  // the list shows the readable link, resolved from the slug the backend stored
  const row = page.getByRole("row").filter({ hasText: bannerTitle });
  await expect(row).toBeVisible();
  await expect(row.getByText(`منتج: ${productName}`)).toBeVisible();
  await expect(row.getByText("ظاهر في المتجر")).toBeVisible();
  await expect(row.locator("img")).toBeVisible();

  // the backend stored exactly a product link with the product's slug
  const stored = (
    await call<{ title: string; link: { type: string; value: string } }[]>(
      "GET",
      "/admin/banners",
      { token: adminToken },
    )
  ).find((b) => b.title === bannerTitle);
  expect(stored?.link.type).toBe("product");
  expect(stored?.link.value).toBeTruthy();

  // edit: new title, link to the sale section (a type with no value)
  await row.getByRole("button", { name: `تعديل: ${bannerTitle}` }).click();
  const editor = page.getByRole("dialog");
  await expect(
    editor.getByTestId("banner-link-product-selected"),
  ).toContainText(productName);
  await editor.getByLabel(/^العنوان \*/).fill(editedTitle);
  await editor.getByRole("combobox", { name: "وجهة الرابط" }).click();
  await page.getByRole("option", { name: "التخفيضات", exact: true }).click();
  await editor.getByRole("button", { name: "حفظ" }).click();
  await expect(editor).toBeHidden();
  const edited = page.getByRole("row").filter({ hasText: editedTitle });
  await expect(edited.getByText("قسم التخفيضات")).toBeVisible();

  // toggle off: the state changes to inactive
  await edited.getByRole("switch", { name: `فعّال: ${editedTitle}` }).click();
  await expect(edited.getByText("غير فعّال")).toBeVisible();

  // delete: nothing happens until the confirmation
  await edited.getByRole("button", { name: `حذف: ${editedTitle}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: editedTitle }),
  ).toHaveCount(0);
});

test("banner: an external link must be https", async ({ page }) => {
  await signIn(page);
  await page
    .getByRole("link", { name: "البانرات", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "إضافة بانر" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("image-input").setInputFiles({
    name: "banner.png",
    mimeType: "image/png",
    buffer: makePng(64),
  });
  await dialog.getByLabel(/^العنوان \*/).fill(`${bannerTitle}-url`);
  await dialog.getByRole("combobox", { name: "وجهة الرابط" }).click();
  await page.getByRole("option", { name: "رابط خارجي", exact: true }).click();
  await dialog.getByLabel("الرابط (https)").fill("http://insecure.example");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog.getByText(/يجب أن يبدأ بـ https/)).toBeVisible();
  await dialog
    .getByLabel("الرابط (https)")
    .fill("https://lamsa.example/offers");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `${bannerTitle}-url` })
      .getByText("رابط خارجي: https://lamsa.example/offers"),
  ).toBeVisible();
});
