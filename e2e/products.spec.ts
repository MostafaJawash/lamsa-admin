import { expect, test, type Page } from "@playwright/test";

import {
  call,
  deleteProductsByPrefix,
  loginViaApi,
  makePng,
} from "./support/backend.ts";

/**
 * Products against the REAL backend (lamsa_test on :8001). Everything is created through
 * the UI under the "e2e-" prefix and removed again; leftovers are swept in global-teardown.
 *
 * The session lives in memory (a reload logs out, by design), so tests move around by
 * clicking, never with page.goto after login.
 */
// Set by global-setup (which runs after this file is loaded), so read it lazily.
const phone = () => process.env.E2E_ADMIN_PHONE as string;
const password = () => process.env.E2E_ADMIN_PASSWORD as string;
test.beforeEach(() =>
  test.skip(!process.env.E2E_ADMIN_PHONE, "backend on :8001 is not running"),
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
let categoryId = 0;
let categoryName = "";
let adminToken = "";

test.beforeAll(async () => {
  if (!process.env.E2E_ADMIN_PHONE) return;
  const admin = await loginViaApi(phone(), password());
  adminToken = admin.access_token;
  // A dedicated category with one color option, so variants can be created.
  categoryName = `e2e-قسم-${stamp}`;
  const category = await call<{ id: number }>("POST", "/admin/categories", {
    token: adminToken,
    body: { name: categoryName },
  });
  categoryId = category.id;
  await call("POST", `/admin/categories/${categoryId}/variant-options`, {
    token: adminToken,
    body: { key: "color", label: "اللون", type: "color" },
  });
});

test.afterAll(async () => {
  if (!adminToken) return;
  await deleteProductsByPrefix(adminToken, "e2e-");
  if (categoryId)
    await call("DELETE", `/admin/categories/${categoryId}`, {
      token: adminToken,
    });
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("رقم الهاتف").fill(phone());
  await page.getByLabel("كلمة المرور").fill(password());
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function openProducts(page: Page) {
  await page
    .getByRole("link", { name: "المنتجات", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "المنتجات", exact: true }),
  ).toBeVisible();
}

async function startCreate(page: Page) {
  await page.getByRole("link", { name: "إضافة منتج" }).click();
  await expect(page.getByRole("heading", { name: "إضافة منتج" })).toBeVisible();
}

async function chooseCategory(page: Page) {
  await page.getByRole("combobox", { name: /القسم/ }).click();
  await page.getByRole("option", { name: categoryName }).click();
}

async function addImage(page: Page) {
  await page.getByTestId("image-input").setInputFiles({
    name: "e2e.png",
    mimeType: "image/png",
    buffer: makePng(),
  });
  await expect(page.getByAltText("e2e.png")).toBeVisible();
}

async function findRow(page: Page, name: string) {
  await page.getByRole("searchbox").fill(name);
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toBeVisible();
  return row;
}

test("simple product: create with an image, edit, adjust stock, delete", async ({
  page,
}) => {
  const name = `e2e-منتج-${stamp}`;
  const renamed = `${name}-معدل`;
  await signIn(page);
  await openProducts(page);

  // create
  await startCreate(page);
  await page.getByLabel(/اسم المنتج/).fill(name);
  await chooseCategory(page);
  await page.getByLabel(/^السعر/).fill("12000");
  await page.getByLabel(/المخزون/).fill("7");
  await addImage(page);
  await page.locator("#is_active").click();
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(
    page.getByRole("heading", { name: "المنتجات", exact: true }),
  ).toBeVisible();

  // it is in the list, active (publishing needed the uploaded image), with price and stock
  let row = await findRow(page, name);
  await expect(row).toContainText("12,000 ل.س");
  await expect(row).toContainText("7");
  await expect(row).toContainText("نشط");
  await expect(row.locator("img")).toBeVisible();

  // edit: change name and price, and the change persists
  await row.getByRole("link", { name: /تعديل/ }).click();
  await expect(page.getByLabel(/اسم المنتج/)).toHaveValue(name);
  await page.getByLabel(/اسم المنتج/).fill(renamed);
  await page.getByLabel(/^السعر/).fill("15000");
  await page.getByRole("button", { name: "حفظ" }).click();
  row = await findRow(page, renamed);
  await expect(row).toContainText("15,000 ل.س");
  await row.getByRole("link", { name: /تعديل/ }).click();
  await expect(page.getByLabel(/^السعر/)).toHaveValue("15000");
  await expect(page.getByLabel(/اسم المنتج/)).toHaveValue(renamed);
  await page.getByRole("button", { name: "رجوع" }).click();

  // stock adjustment through the dedicated endpoint
  row = await findRow(page, renamed);
  await row.getByRole("button", { name: /تعديل المخزون/ }).click();
  await page.locator("#stock-delta").fill("3");
  await page.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(await findRow(page, renamed)).toContainText("10");

  // delete
  row = await findRow(page, renamed);
  await row.getByRole("button", { name: /حذف/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(renamed) }),
  ).toHaveCount(0);
});

test("variable product: create with a variant, then delete", async ({
  page,
}) => {
  const name = `e2e-متغير-${stamp}`;
  await signIn(page);
  await openProducts(page);
  await startCreate(page);

  await page.getByLabel(/اسم المنتج/).fill(name);
  await chooseCategory(page);
  await page.getByRole("combobox", { name: "نوع المنتج" }).click();
  await page.getByRole("option", { name: "متعدد الخيارات" }).click();

  const variants = page.getByRole("group", { name: /الخيار 1/ });
  await variants.getByLabel("اللون", { exact: true }).fill("أحمر");
  await variants.getByLabel("السعر", { exact: true }).fill("5000");
  await variants.getByLabel("المخزون", { exact: true }).fill("4");
  await addImage(page);
  await page.locator("#is_active").click();
  await page.getByRole("button", { name: "حفظ" }).click();

  await expect(
    page.getByRole("heading", { name: "المنتجات", exact: true }),
  ).toBeVisible();
  const row = await findRow(page, name);
  await expect(row).toContainText("من");
  await expect(row).toContainText("5,000 ل.س");
  await expect(row).toContainText("متعدد");
  await expect(row).toContainText("نشط");

  // the variant is on the edit page with its backend values
  await row.getByRole("link", { name: /تعديل/ }).click();
  const edited = page.getByRole("group", { name: /الخيار 1/ });
  await expect(edited.getByLabel("اللون", { exact: true })).toHaveValue("أحمر");
  await expect(edited.getByLabel("السعر", { exact: true })).toHaveValue("5000");
  await page.getByRole("button", { name: "رجوع" }).click();

  const again = await findRow(page, name);
  await again.getByRole("button", { name: /حذف/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(
    0,
  );
});

test("required fields are reported before anything is sent", async ({
  page,
}) => {
  await signIn(page);
  await openProducts(page);
  await startCreate(page);
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("أدخل اسم المنتج.")).toBeVisible();
  await expect(page.getByText("اختر القسم.")).toBeVisible();
});
