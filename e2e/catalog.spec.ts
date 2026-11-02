import { expect, test, type Page } from "@playwright/test";

import {
  call,
  deleteCatalogByPrefix,
  deleteProductsByPrefix,
  loginViaApi,
  makePng,
} from "./support/backend.ts";

/**
 * Categories, attributes, variant options and brands against the REAL backend (lamsa_test on
 * :8001), including the integration the products page depends on: a product created in a
 * category picks up that category's attributes and variant options. Everything is created
 * through the UI under the "e2e-" prefix; nothing here needs SQL (no orders are involved), so
 * cleanup is the normal API (afterAll here, and the sweep in global-teardown).
 */
const phone = () => process.env.E2E_ADMIN_PHONE as string;
const password = () => process.env.E2E_ADMIN_PASSWORD as string;
test.beforeEach(() =>
  test.skip(!process.env.E2E_ADMIN_PHONE, "backend on :8001 is not running"),
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const category = `e2e-cat-${stamp}`;
const renamed = `${category}-معدل`;
const productName = `e2e-cat-prod-${stamp}`;
let adminToken = "";

test.beforeAll(async () => {
  if (!process.env.E2E_ADMIN_PHONE) return;
  adminToken = (await loginViaApi(phone(), password())).access_token;
});

test.afterAll(async () => {
  if (!adminToken) return;
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

/** Moves around by clicking (a reload ends the in-memory session, by design). */
async function openSection(page: Page, name: string) {
  await page.getByRole("link", { name, exact: true }).first().click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

async function openCategoryEditor(page: Page, name: string) {
  await openSection(page, "الأقسام");
  await page.getByRole("link", { name, exact: true }).first().click();
  await expect(
    page.getByRole("heading", { name: "تعديل القسم" }),
  ).toBeVisible();
}

/** Looks a product up by exact name in the newest products (full-text search is not needed). */
async function findProduct(name: string): Promise<{ id: number } | undefined> {
  const found = await call<{ items: { id: number; name: string }[] }>(
    "GET",
    "/admin/products?page_size=100",
    { token: adminToken },
  );
  return found.items.find((product) => product.name === name);
}

async function productId(name: string): Promise<number> {
  return (await findProduct(name))!.id;
}

test("category: create it, add a required text attribute and a color option, rename it", async ({
  page,
}) => {
  await signIn(page);
  await openSection(page, "الأقسام");

  // create: the basic fields, with a slug suggested from the latin name
  await page.getByRole("link", { name: "إضافة قسم" }).click();
  await page.getByLabel(/اسم القسم/).fill(category);
  await expect(page.getByLabel("الرابط المختصر")).toHaveValue(category);
  await page.getByRole("button", { name: "حفظ" }).click();
  // saving a new category opens its edit page
  await expect(
    page.getByRole("heading", { name: "تعديل القسم" }),
  ).toBeVisible();
  await expect(page.getByLabel(/اسم القسم/)).toHaveValue(category);

  // a required text attribute
  await page.getByRole("button", { name: "إضافة خاصية" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/المفتاح/).fill("note");
  await dialog.getByLabel(/الاسم \(يظهر للمستخدم\)/).fill("ملاحظة");
  await dialog.getByRole("switch", { name: /مطلوبة عند إضافة منتج/ }).click();
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const attribute = page
    .getByText("ملاحظة", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(attribute).toContainText("note");
  await expect(attribute).toContainText("مطلوبة");

  // a color variant option
  await page.getByRole("button", { name: "إضافة خيار" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/المفتاح/).fill("color");
  await dialog.getByLabel(/الاسم \(يظهر للمستخدم\)/).fill("اللون");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText("اللون", { exact: true }).locator("xpath=ancestor::li[1]"),
  ).toContainText("color");

  // the backend agrees about what was stored
  const tree = await call<{ id: number; name: string }[]>(
    "GET",
    "/admin/categories",
    { token: adminToken },
  );
  const id = (tree.find((c) => c.name === category) as { id: number }).id;
  const stored = await call<{
    effective_attributes: { key: string; is_required: boolean; type: string }[];
    effective_variant_options: { key: string; type: string }[];
  }>("GET", `/admin/categories/${id}`, { token: adminToken });
  expect(stored.effective_attributes).toMatchObject([
    { key: "note", is_required: true, type: "text" },
  ]);
  expect(stored.effective_variant_options).toMatchObject([
    { key: "color", type: "color" },
  ]);

  // back to the list, where it appears; rename it from its edit page
  await page.getByRole("button", { name: "رجوع" }).click();
  await expect(
    page.getByRole("link", { name: category, exact: true }),
  ).toBeVisible();
  await openCategoryEditor(page, category);
  await page.getByLabel(/اسم القسم/).fill(renamed);
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(
    page.getByRole("heading", { name: "الأقسام", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: renamed, exact: true }),
  ).toBeVisible();
});

test("integration: a product in that category gets its required attribute and color option", async ({
  page,
}) => {
  await signIn(page);
  await openSection(page, "المنتجات");
  await page.getByRole("link", { name: "إضافة منتج" }).click();
  await page.getByLabel(/اسم المنتج/).fill(productName);
  await page.getByLabel(/^السعر/).fill("1000");
  await page.getByLabel(/المخزون/).fill("1");

  // before a category is chosen there are no attribute fields
  await expect(page.getByLabel("ملاحظة *")).toHaveCount(0);
  await page.getByRole("combobox", { name: /القسم/ }).click();
  await page.getByRole("option", { name: renamed, exact: true }).click();

  // the category's required attribute appears, and is enforced
  const field = page.getByLabel("ملاحظة *");
  await expect(field).toBeVisible();
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("هذه الخاصية مطلوبة.")).toBeVisible();
  expect(await findProduct(productName)).toBeUndefined();

  // its color variant option shows up for a variable product too
  await page.getByRole("combobox", { name: "نوع المنتج" }).click();
  await page.getByRole("option", { name: "متعدد الخيارات" }).click();
  await expect(
    page
      .getByRole("group", { name: /الخيار 1/ })
      .getByLabel("اللون", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "نوع المنتج" }).click();
  await page.getByRole("option", { name: "بسيط" }).click();

  await field.fill("قيمة الملاحظة");
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(
    page.getByRole("heading", { name: "المنتجات", exact: true }),
  ).toBeVisible();

  const stored = await call<{
    attributes: Record<string, unknown>;
    category: { name: string };
  }>("GET", `/admin/products/${await productId(productName)}`, {
    token: adminToken,
  });
  expect(stored.attributes).toEqual({ note: "قيمة الملاحظة" });
  expect(stored.category.name).toBe(renamed);
});

test("an attribute that products use is refused, then removed from them only on a forced delete", async ({
  page,
}) => {
  await signIn(page);
  await openCategoryEditor(page, renamed);

  await page.getByRole("button", { name: /حذف: ملاحظة/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  // refused by the backend: a second confirmation explains the consequence
  await expect(
    page.getByText(/ستُحذف قيمة هذه الخاصية من 1 منتج/),
  ).toBeVisible();
  const id = await productId(productName);
  const before = await call<{ attributes: Record<string, unknown> }>(
    "GET",
    `/admin/products/${id}`,
    { token: adminToken },
  );
  expect(before.attributes).toEqual({ note: "قيمة الملاحظة" });

  await page.getByRole("button", { name: "حذف وإزالتها من المنتجات" }).click();
  await expect(page.getByText("ملاحظة", { exact: true })).toHaveCount(0);
  const after = await call<{ attributes: Record<string, unknown> }>(
    "GET",
    `/admin/products/${id}`,
    { token: adminToken },
  );
  expect(after.attributes).toEqual({});
});

test("a required attribute added after a product exists is asked for when that product is edited", async ({
  page,
}) => {
  await signIn(page);
  await openCategoryEditor(page, renamed);
  await page.getByRole("button", { name: "إضافة خاصية" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/المفتاح/).fill("extra");
  await dialog.getByLabel(/الاسم \(يظهر للمستخدم\)/).fill("إضافية");
  await dialog.getByRole("switch", { name: /مطلوبة عند إضافة منتج/ }).click();
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // the existing product now needs it (the products form reads the category fresh)
  await page.getByRole("button", { name: "رجوع" }).click();
  await openSection(page, "المنتجات");
  await page.getByRole("searchbox").fill(productName);
  await page
    .getByRole("row", { name: new RegExp(productName) })
    .getByRole("link", { name: /تعديل/ })
    .click();
  await expect(page.getByLabel("إضافية *")).toBeVisible();
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("هذه الخاصية مطلوبة.")).toBeVisible();
});

test("a category holding products cannot be deleted; once empty it can", async ({
  page,
}) => {
  await signIn(page);
  await openSection(page, "الأقسام");
  await page
    .getByRole("button", { name: new RegExp(`حذف: ${renamed}`) })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  // the backend's own message, with the count, and the category is still there
  await expect(
    page.getByText(/لا يمكن حذف قسم يحتوي على أقسام فرعية أو منتجات/),
  ).toBeVisible();
  await expect(page.getByText(/منتجات: 1/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: renamed, exact: true }),
  ).toBeVisible();

  // remove the product from the products page, then delete the now empty category
  await openSection(page, "المنتجات");
  await page.getByRole("searchbox").fill(productName);
  await page
    .getByRole("row", { name: new RegExp(productName) })
    .getByRole("button", { name: /حذف/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(productName) }),
  ).toHaveCount(0);

  await openSection(page, "الأقسام");
  await page
    .getByRole("button", { name: new RegExp(`حذف: ${renamed}`) })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(
    page.getByRole("link", { name: renamed, exact: true }),
  ).toHaveCount(0);
});

test("brand: create with a logo, edit, deactivate, and delete", async ({
  page,
}) => {
  const brand = `e2e-brand-${stamp}`;
  await signIn(page);
  await openSection(page, "الماركات");

  await page.getByRole("button", { name: "إضافة ماركة" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/اسم الماركة/).fill(brand);
  await expect(dialog.getByLabel("الرابط المختصر")).toHaveValue(brand);
  await dialog.getByTestId("image-input").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: makePng(),
  });
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("searchbox").fill(brand);
  let row = page.getByRole("row", { name: new RegExp(brand) });
  await expect(row).toBeVisible();
  await expect(row.locator("img")).toBeVisible(); // the logo was uploaded after the brand was created
  await expect(row).toContainText("نشطة");

  // edit: rename and deactivate
  await row.getByRole("button", { name: /تعديل/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/اسم الماركة/).fill(`${brand}-معدلة`);
  await dialog.getByRole("switch", { name: /نشطة/ }).click();
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("searchbox").fill(brand);
  row = page.getByRole("row", { name: new RegExp(`${brand}-معدلة`) });
  await expect(row).toContainText("غير نشطة");
  const saved = await call<{
    items: { name: string; is_active: boolean; slug: string }[];
  }>("GET", `/admin/brands?search=${encodeURIComponent(brand)}`, {
    token: adminToken,
  });
  expect(saved.items[0]).toMatchObject({
    name: `${brand}-معدلة`,
    is_active: false,
    slug: brand,
  });

  // delete
  await row.getByRole("button", { name: /حذف/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(page.getByRole("row", { name: new RegExp(brand) })).toHaveCount(
    0,
  );
});

test("a brand that has products cannot be deleted", async ({ page }) => {
  const brand = `e2e-brand-used-${stamp}`;
  const holder = await call<{ id: number }>("POST", "/admin/brands", {
    token: adminToken,
    body: { name: brand },
  });
  const cat = await call<{ id: number }>("POST", "/admin/categories", {
    token: adminToken,
    body: { name: `e2e-brand-cat-${stamp}` },
  });
  await call("POST", "/admin/products", {
    token: adminToken,
    body: {
      type: "simple",
      currency: "SYP",
      name: `e2e-brand-prod-${stamp}`,
      category_id: cat.id,
      brand_id: holder.id,
      price: "1000",
      stock: 1,
    },
  });

  await signIn(page);
  await openSection(page, "الماركات");
  await page.getByRole("searchbox").fill(brand);
  const row = page.getByRole("row", { name: new RegExp(brand) });
  await expect(row).toContainText("1"); // product count
  await row.getByRole("button", { name: /حذف/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText(/لا يمكن حذف ماركة لها منتجات/)).toBeVisible();
  await expect(page.getByText(/منتجات: 1/)).toBeVisible();
  await expect(row).toBeVisible();
});
