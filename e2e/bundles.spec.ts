import { expect, test, type Page } from "@playwright/test";

import {
  call,
  deleteProductsByPrefix,
  loginViaApi,
} from "./support/backend.ts";

/**
 * Bundle contents against the REAL backend (lamsa_test on :8001): components are made
 * through the API, the bundle and its contents through the UI under the "e2e-" prefix.
 * What the backend stored is checked through the API; everything is removed again
 * (bundle first, then its components) and leftovers are swept in global-teardown.
 */
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
const components: { id: number; name: string }[] = [];

type StoredBundle = {
  id: number;
  type: string;
  bundle_items: {
    product_id: number;
    variant_id: number | null;
    quantity: number;
  }[];
};

test.beforeAll(async () => {
  if (!process.env.E2E_ADMIN_PHONE) return;
  adminToken = (await loginViaApi(phone(), password())).access_token;
  categoryName = `e2e-قسم-علبة-${stamp}`;
  categoryId = (
    await call<{ id: number }>("POST", "/admin/categories", {
      token: adminToken,
      body: { name: categoryName },
    })
  ).id;
  const prices = ["5000", "7500", "3000"];
  for (const [index, price] of prices.entries()) {
    const name = `e2e-مكون-${index + 1}-${stamp}`;
    const created = await call<{ id: number }>("POST", "/admin/products", {
      token: adminToken,
      body: {
        type: "simple",
        name,
        category_id: categoryId,
        price,
        stock: 10,
      },
    });
    components.push({ id: created.id, name });
  }
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

async function addComponent(page: Page, name: string) {
  await page
    .getByRole("searchbox", { name: /ابحث عن منتج لإضافته/ })
    .fill(name);
  await page
    .getByRole("listbox", { name: /ابحث عن منتج لإضافته/ })
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await expect(page.getByLabel(`الكمية: ${name}`)).toBeVisible();
}

async function storedBundle(name: string): Promise<StoredBundle> {
  const found = await call<{ items: { id: number; name: string }[] }>(
    "GET",
    `/admin/products?q=${encodeURIComponent(name)}&page_size=10`,
    { token: adminToken },
  );
  const match = found.items.filter((item) => item.name === name);
  expect(match).toHaveLength(1);
  return call<StoredBundle>("GET", `/admin/products/${match[0]?.id}`, {
    token: adminToken,
  });
}

test("bundle: create with components, edit its contents, and both persist", async ({
  page,
}) => {
  test.skip(components.length < 3, "components were not created");
  const [a, b, c] = components as [
    (typeof components)[0],
    (typeof components)[0],
    (typeof components)[0],
  ];
  const name = `e2e-علبة-${stamp}`;
  await signIn(page);
  await page
    .getByRole("link", { name: "المنتجات", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "إضافة منتج" }).click();

  // the contents section only exists for a bundle
  await expect(
    page.getByRole("heading", { name: "محتويات العلبة" }),
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "نوع المنتج" }).click();
  await page.getByRole("option", { name: "علبة هدايا" }).click();
  await expect(
    page.getByText("لم تتم إضافة منتجات لهذه العلبة بعد"),
  ).toBeVisible();

  await page.getByLabel(/اسم المنتج/).fill(name);
  await page.getByRole("combobox", { name: /القسم/ }).click();
  await page.getByRole("option", { name: categoryName }).click();
  await page.getByLabel(/^السعر/).fill("10000");

  await addComponent(page, a.name);
  await addComponent(page, b.name);
  await page.getByLabel(`الكمية: ${a.name}`).fill("2");
  // 5,000 × 2 + 7,500 = 17,500 against the bundle's 10,000
  await expect(page.getByTestId("bundle-total")).toHaveText("17,500 ل.س");
  await expect(page.getByTestId("bundle-saving")).toContainText("7,500 ل.س");
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(
    page.getByRole("heading", { name: "المنتجات", exact: true }),
  ).toBeVisible();

  // what the backend stored
  let bundle = await storedBundle(name);
  expect(bundle.type).toBe("bundle");
  expect(
    bundle.bundle_items.map(({ product_id, quantity }) => [
      product_id,
      quantity,
    ]),
  ).toEqual([
    [a.id, 2],
    [b.id, 1],
  ]);

  // edit: reload the contents from the backend, drop one, add another, change a quantity
  await page.getByRole("searchbox").fill(name);
  await page
    .getByRole("row", { name: new RegExp(name) })
    .getByRole("link", { name: /تعديل/ })
    .click();
  await expect(page.getByLabel(`الكمية: ${a.name}`)).toHaveValue("2");
  await expect(page.getByLabel(`الكمية: ${b.name}`)).toHaveValue("1");
  await page
    .getByRole("button", { name: `إزالة من العلبة: ${b.name}` })
    .click();
  await addComponent(page, c.name);
  await page.getByLabel(`الكمية: ${c.name}`).fill("3");
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(
    page.getByRole("heading", { name: "المنتجات", exact: true }),
  ).toBeVisible();

  bundle = await storedBundle(name);
  expect(
    bundle.bundle_items.map(({ product_id, quantity }) => [
      product_id,
      quantity,
    ]),
  ).toEqual([
    [a.id, 2],
    [c.id, 3],
  ]);

  // reopen: the persisted list is what the editor shows (the removed one is gone)
  await page.getByRole("searchbox").fill(name);
  await page
    .getByRole("row", { name: new RegExp(name) })
    .getByRole("link", { name: /تعديل/ })
    .click();
  await expect(page.getByLabel(`الكمية: ${c.name}`)).toHaveValue("3");
  await expect(page.getByLabel(`الكمية: ${b.name}`)).toHaveCount(0);

  // clean up the bundle through the API (components go in afterAll)
  await call("DELETE", `/admin/products/${bundle.id}`, { token: adminToken });
  await expect(
    call("GET", `/admin/products/${bundle.id}`, { token: adminToken }),
  ).rejects.toThrow();
});
