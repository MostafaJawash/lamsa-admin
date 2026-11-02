import { expect, test, type Page } from "@playwright/test";

import { call, loginViaApi } from "./support/backend.ts";
import { createOrders, type Fixture } from "./support/orders.ts";

/**
 * Orders against the REAL backend (lamsa_test on :8001). The orders come from the real
 * customer flow (see support/orders.ts); the admin UI is then driven by clicking (a reload
 * ends the in-memory session, by design). Cleanup is in global-teardown.
 */
const phone = () => process.env.E2E_ADMIN_PHONE as string;
const password = () => process.env.E2E_ADMIN_PASSWORD as string;
test.beforeEach(() =>
  test.skip(!process.env.E2E_ADMIN_PHONE, "backend on :8001 is not running"),
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
let fixture: Fixture;
let adminToken = "";

type AdminOrder = {
  status: string;
  history: { to_status: string; note: string | null }[];
  can_cancel: boolean;
  timeline: { status: string; cancel_reason: string | null }[];
};
const adminOrder = (id: number) =>
  call<AdminOrder>("GET", `/admin/orders/${id}`, { token: adminToken });

test.beforeAll(async () => {
  if (!process.env.E2E_ADMIN_PHONE) return;
  adminToken = (await loginViaApi(phone(), password())).access_token;
  fixture = await createOrders(adminToken, stamp, 2);
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("رقم الهاتف").fill(phone());
  await page.getByLabel("كلمة المرور").fill(password());
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function openOrders(page: Page) {
  await page
    .getByRole("link", { name: "الطلبات", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "الطلبات", exact: true }),
  ).toBeVisible();
}

/** Finds an order's row by its number (the search matches the exact order number). */
async function findRow(page: Page, id: number) {
  await page.getByRole("searchbox").fill(String(id));
  const row = page.getByRole("row", { name: new RegExp(`#${id}\\b`) });
  await expect(row).toBeVisible();
  return row;
}

test("the list shows a real order with customer, totals, delivery and status", async ({
  page,
}) => {
  const id = fixture.orderIds[0] as number;
  await signIn(page);
  await openOrders(page);

  const row = await findRow(page, id);
  await expect(row).toContainText(fixture.customerName);
  await expect(row).toContainText("ل.س");
  await expect(row).toContainText("التوصيل داخل دمشق");
  await expect(row.getByText("تم استلام طلبك")).toHaveAttribute(
    "data-status",
    "pending",
  );

  // the at-a-glance strip counts it, and clicking it filters the list by status
  const tile = page.getByRole("button", { name: /طلبات جديدة/ });
  await expect(tile).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await tile.click();
  await expect(page).toHaveURL(/status=pending/);
  await expect(
    page.getByRole("row", { name: new RegExp(`#${id}\\b`) }),
  ).toBeVisible();
});

test("detail: open an order, move it forward and see the badge, timeline and history update", async ({
  page,
}) => {
  const id = fixture.orderIds[0] as number;
  await signIn(page);
  await openOrders(page);
  await (
    await findRow(page, id)
  )
    .getByRole("link", { name: /عرض التفاصيل/ })
    .click();

  // the full order
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`#${id}`);
  await expect(
    page.getByText(fixture.customerName, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("دمشق، المزة")).toBeVisible();
  await expect(page.getByText("شارع الجلاء، بناء 12")).toBeVisible();
  await expect(
    page.getByRole("link", { name: fixture.productName }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /فتح الموقع/ })).toHaveAttribute(
    "href",
    /google\.com\/maps\?q=33\.5138/,
  );
  await expect(page.getByText("الدفع عند الاستلام")).toBeVisible();
  // only the one valid next step is offered (and cancel)
  await expect(page.getByRole("button", { name: "بدء التجهيز" })).toBeVisible();
  await expect(page.getByRole("button", { name: "تم الشحن" })).toHaveCount(0);

  // pending -> preparing, with a note
  await page.getByRole("button", { name: "بدء التجهيز" }).click();
  await page.getByLabel(/ملاحظة/).fill("e2e: بدأ التجهيز");
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(
    page
      .getByRole("heading", { level: 1 })
      .locator("xpath=following-sibling::span[1]"),
  ).toHaveText("قيد التجهيز");
  await expect(page.getByText("e2e: بدأ التجهيز")).toBeVisible();
  await expect(page.locator('ol > li[aria-current="step"]')).toHaveAttribute(
    "data-status",
    "preparing",
  );
  // now only the following step is offered
  await expect(page.getByRole("button", { name: "تم الشحن" })).toBeVisible();
  await expect(page.getByRole("button", { name: "بدء التجهيز" })).toHaveCount(
    0,
  );

  // the change persisted on the backend, with who/what in the history
  const saved = await adminOrder(id);
  expect(saved.status).toBe("preparing");
  expect(saved.history.at(-1)).toMatchObject({
    to_status: "preparing",
    note: "e2e: بدأ التجهيز",
  });

  // preparing -> shipped
  await page.getByRole("button", { name: "تم الشحن" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(page.locator('ol > li[aria-current="step"]')).toHaveAttribute(
    "data-status",
    "shipped",
  );
  expect((await adminOrder(id)).status).toBe("shipped");

  // back in the list the badge shows the new status
  await page.getByRole("link", { name: "العودة إلى الطلبات" }).click();
  const row = await findRow(page, id);
  await expect(row.getByText("تم الشحن")).toHaveAttribute(
    "data-status",
    "shipped",
  );
});

test("cancelling needs a reason, restores stock and ends the workflow", async ({
  page,
}) => {
  const id = fixture.orderIds[1] as number;
  const stockBefore = (
    await call<{ stock: number }>(
      "GET",
      `/admin/products/${fixture.productId}`,
      { token: adminToken },
    )
  ).stock;
  await signIn(page);
  await openOrders(page);
  await (
    await findRow(page, id)
  )
    .getByRole("link", { name: /عرض التفاصيل/ })
    .click();

  await page.getByRole("button", { name: "إلغاء الطلب" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/سيُعاد مخزون المنتجات/)).toBeVisible();
  // no reason: stays open, nothing cancelled
  await dialog.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(dialog.getByText(/3 أحرف على الأقل/)).toBeVisible();
  expect((await adminOrder(id)).status).toBe("pending");

  await dialog.getByLabel(/سبب الإلغاء/).fill("e2e: العميل لم يرد");
  await dialog.getByRole("button", { name: "إلغاء الطلب" }).click();

  await expect(page.getByText(/e2e: العميل لم يرد/).first()).toBeVisible();
  await expect(
    page.getByText("لا توجد إجراءات متاحة لهذا الطلب."),
  ).toBeVisible();
  const saved = await adminOrder(id);
  expect(saved.status).toBe("cancelled");
  expect(saved.can_cancel).toBe(false);
  expect(saved.timeline.at(-1)?.cancel_reason).toBe("e2e: العميل لم يرد");

  // the unit went back to the shelf
  const stockAfter = (
    await call<{ stock: number }>(
      "GET",
      `/admin/products/${fixture.productId}`,
      { token: adminToken },
    )
  ).stock;
  expect(stockAfter).toBe(stockBefore + 1);
});
