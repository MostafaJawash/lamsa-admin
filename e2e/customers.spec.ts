import { expect, test, type Page } from "@playwright/test";

import {
  BackendError,
  call,
  loginViaApi,
  PASSWORD,
} from "./support/backend.ts";
import { createOrders, type Fixture } from "./support/orders.ts";

/**
 * Customers against the REAL backend (lamsa_test on :8001). The customer, their address and
 * their orders come from the real customer flow (support/orders.ts, as for the orders spec);
 * the admin UI is driven by clicking (a reload ends the in-memory session, by design).
 * Cleanup is in global-teardown: orders by SQL on lamsa_test (the established, guarded step),
 * then the customer (reactivated first if a test left them deactivated), product and category
 * through the API.
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

type AdminUser = {
  id: number;
  is_active: boolean;
  must_change_password: boolean;
  orders_count: number;
};
async function customerRecord(): Promise<AdminUser> {
  const found = await call<{ items: AdminUser[] }>(
    "GET",
    `/admin/users?search=${encodeURIComponent(fixture.phone)}&role=customer`,
    { token: adminToken },
  );
  return found.items[0] as AdminUser;
}

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

async function openCustomers(page: Page) {
  await page
    .getByRole("link", { name: "العملاء", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "العملاء", exact: true }),
  ).toBeVisible();
}

/** Lists the customers, finds ours by phone and opens their page. */
async function openCustomer(page: Page) {
  await openCustomers(page);
  await page.getByRole("searchbox").fill(fixture.phone);
  await page
    .getByRole("link", { name: fixture.customerName, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: fixture.customerName }),
  ).toBeVisible();
}

test("the list shows a registered customer with their order count, account type and status", async ({
  page,
}) => {
  await signIn(page);
  await openCustomers(page);
  await page.getByRole("searchbox").fill(fixture.phone);
  const row = page.getByRole("row", { name: new RegExp(fixture.customerName) });
  await expect(row).toBeVisible();
  await expect(row).toContainText(fixture.phone);
  await expect(row).toContainText("هاتف وكلمة مرور");
  await expect(row.getByText("نشط", { exact: true })).toBeVisible();
  await expect(row.getByRole("cell").nth(4)).toHaveText("2"); // orders
  // admins are never listed here (the list is scoped to customers)
  await page.getByRole("searchbox").fill("e2e-admin");
  await expect(
    page.getByText("لا يوجد عملاء يطابقون الفلاتر المحددة."),
  ).toBeVisible();
});

test("detail: profile, order history with working links, and the address as the customer saved it", async ({
  page,
}) => {
  const [first, second] = fixture.orderIds as [number, number];
  await signIn(page);
  await openCustomer(page);

  // profile
  await expect(page.getByText(fixture.phone)).toBeVisible();
  await expect(page.getByText("هاتف وكلمة مرور").first()).toBeVisible();

  // both orders are in the history, newest first, with per-currency totals
  const rows = page.getByRole("row").filter({ hasText: /#\d+/ });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(`#${second}`);
  await expect(rows.first()).toContainText("ل.س");
  await expect(page.getByRole("columnheader", { name: "العميل" })).toHaveCount(
    0,
  );

  // the address section is the latest order's stored address, equal to what the customer saved
  const saved = await call<
    { governorate: string; area: string; details: string }[]
  >("GET", "/users/me/addresses", {
    token: (await loginViaApi(fixture.phone)).access_token,
  });
  expect(saved).toHaveLength(1);
  await expect(page.getByText("عنوان آخر طلب")).toBeVisible();
  await expect(page.getByText(`دمشق، ${saved[0]?.area}`)).toBeVisible(); // governorate name + area
  await expect(page.getByText(saved[0]?.details as string)).toBeVisible();
  expect(saved[0]?.governorate).toBe("damascus");

  // an order links to its page, and the order's customer name links back here
  await page.getByRole("link", { name: `#${first}`, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    `#${first}`,
  );
  await page
    .getByRole("link", { name: fixture.customerName, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: fixture.customerName }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/customers/${(await customerRecord()).id}$`),
  );
});

test("deactivating stops the customer from signing in, and reactivating restores it", async ({
  page,
}) => {
  await signIn(page);
  await openCustomer(page);
  const before = await customerRecord();
  expect(before.is_active).toBe(true);
  await loginViaApi(fixture.phone); // can log in now

  await page.getByRole("button", { name: "تعطيل الحساب" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/طلباته الحالية وعناوينه لا تتأثر/),
  ).toBeVisible();
  expect((await customerRecord()).is_active).toBe(true); // nothing yet
  await dialog.getByRole("button", { name: "تعطيل", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تفعيل الحساب" }),
  ).toBeVisible();

  // persisted: the backend refuses the customer's login, but their orders are untouched
  expect((await customerRecord()).is_active).toBe(false);
  await expect(loginViaApi(fixture.phone)).rejects.toMatchObject({
    status: 403,
    code: "ACCOUNT_DISABLED",
  } satisfies Partial<BackendError>);
  expect((await customerRecord()).orders_count).toBe(2);

  // and the list shows it
  await page.getByRole("link", { name: "العودة إلى العملاء" }).click();
  await page.getByRole("searchbox").fill(fixture.phone);
  await expect(
    page
      .getByRole("row", { name: new RegExp(fixture.customerName) })
      .getByText("معطّل"),
  ).toBeVisible();

  // reactivate from the detail page
  await page
    .getByRole("link", { name: fixture.customerName, exact: true })
    .click();
  await page.getByRole("button", { name: "تفعيل الحساب" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "تفعيل", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "تعطيل الحساب" }),
  ).toBeVisible();
  expect((await customerRecord()).is_active).toBe(true);
  await loginViaApi(fixture.phone); // can log in again
});

test("resetting a password needs the typed word, shows a one-time password that really works", async ({
  page,
}) => {
  await signIn(page);
  await openCustomer(page);

  await page.getByRole("button", { name: "إعادة تعيين كلمة المرور" }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "إنشاء كلمة مرور مؤقتة" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/اكتب كلمة/).fill("تأكيد");
  await expect(confirm).toBeEnabled();
  // nothing changed until now: the old password still works
  await loginViaApi(fixture.phone);
  await confirm.click();

  const shown = dialog.getByTestId("temporary-password");
  await expect(shown).toBeVisible();
  const temporary = (await shown.textContent())?.trim() as string;
  expect(temporary).toHaveLength(10);

  // the password is real: the old one is dead, the temporary one logs in and must be changed
  await expect(loginViaApi(fixture.phone, PASSWORD)).rejects.toMatchObject({
    status: 401,
  });
  const pair = await call<{
    access_token: string;
    user: { must_change_password: boolean };
  }>("POST", "/auth/login", {
    body: { phone: fixture.phone, password: temporary },
  });
  expect(pair.user.must_change_password).toBe(true);

  // closing forgets it
  // the footer button (the corner "X" has an invisible label only)
  await dialog
    .locator("button:not(:has(.sr-only))", { hasText: "إغلاق" })
    .click();
  await expect(page.getByTestId("temporary-password")).toHaveCount(0);
  await expect(page.getByText("كلمة مرور مؤقتة بانتظار التغيير")).toBeVisible();

  // put the customer's password back so the account can be cleaned up like the others
  await call("POST", "/auth/password/change", {
    token: pair.access_token,
    body: { current_password: temporary, new_password: PASSWORD },
  });
  await loginViaApi(fixture.phone);
  expect((await customerRecord()).must_change_password).toBe(false);
});
