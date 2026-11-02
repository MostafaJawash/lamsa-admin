import { expect, test, type Page } from "@playwright/test";

import { API, call, loginViaApi } from "./support/backend.ts";
import { createOrders, type Fixture } from "./support/orders.ts";

/**
 * The dashboard against the REAL backend (lamsa_test on :8001): orders come from the real
 * customer flow (support/orders.ts), low stock from the existing stock-adjust endpoint.
 * The page is read-only. Cleanup is in global-teardown.
 */
const phone = () => process.env.E2E_ADMIN_PHONE as string;
const password = () => process.env.E2E_ADMIN_PASSWORD as string;
test.beforeEach(() =>
  test.skip(!process.env.E2E_ADMIN_PHONE, "backend on :8001 is not running"),
);
test.describe.configure({ mode: "serial" });

let fixture: Fixture;
let adminToken = "";

type Stats = { counts: Record<string, number> };

test.beforeAll(async () => {
  if (!process.env.E2E_ADMIN_PHONE) return;
  adminToken = (await loginViaApi(phone(), password())).access_token;
  fixture = await createOrders(adminToken, Date.now(), 2);
  // stock 10, minus the 2 ordered units -> 0: the lowest possible, so it is listed first among low-stock items
  await call("POST", `/admin/products/${fixture.productId}/stock-adjust`, {
    token: adminToken,
    body: { delta: -8 },
  });
});

/** Logs in; the app lands on the dashboard. Requests are recorded from the submit on. */
async function signIn(page: Page): Promise<string[]> {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(API))
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.goto("/login");
  await page.getByLabel("رقم الهاتف").fill(phone());
  await page.getByLabel("كلمة المرور").fill(password());
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByTestId("stat-cards")).toBeVisible();
  return requests;
}

test("login lands on the dashboard; a fresh load fires exactly three data requests", async ({
  page,
}) => {
  const requests = await signIn(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "لوحة التحكم", level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId("recent-orders-loading")).toHaveCount(0);
  await expect(page.getByTestId("low-stock-loading")).toHaveCount(0);

  const data = requests.filter((r) => r.includes("/admin/"));
  expect(data.sort()).toEqual([
    "GET /api/v1/admin/orders",
    "GET /api/v1/admin/orders/stats",
    "GET /api/v1/admin/products/low-stock",
  ]);
  // everything the page did besides login itself
  console.log("dashboard requests after submit:", requests.join(" | "));
});

test("stat cards match the real stats and link to the pre-filtered orders list", async ({
  page,
}) => {
  const stats = await call<Stats>("GET", "/admin/orders/stats", {
    token: adminToken,
  });
  expect(stats.counts.pending).toBeGreaterThanOrEqual(2);
  await signIn(page);
  await expect(
    page.getByTestId("stat-pending").getByText(String(stats.counts.pending)),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("stat-preparing")
      .getByText(String(stats.counts.preparing)),
  ).toBeVisible();

  await page.getByTestId("stat-pending").click();
  await expect(page).toHaveURL(/\/orders\?status=pending$/);
  await expect(
    page.getByRole("heading", { name: "الطلبات", exact: true }),
  ).toBeVisible();
  // the filter is applied: our pending order is listed, and every row is "pending"
  await expect(
    page.getByRole("row", { name: new RegExp(`#${fixture.orderIds[0]}\\b`) }),
  ).toBeVisible();
  await expect(page.locator("tbody [data-status]").first()).toHaveAttribute(
    "data-status",
    "pending",
  );
  expect(
    await page
      .locator("tbody [data-status]:not([data-status=pending])")
      .count(),
  ).toBe(0);
});

test("a low-stock product appears and opens its edit page", async ({
  page,
}) => {
  await signIn(page);
  const widget = page.getByTestId("low-stock");
  const link = widget.getByRole("link", { name: fixture.productName });
  await expect(link).toBeVisible();
  await expect(link.getByTestId("stock-badge")).toHaveText("المتبقي: 0");
  await link.click();
  await expect(page).toHaveURL(
    new RegExp(`/products/${fixture.productId}/edit$`),
  );
});

test("recent orders list the newest orders and open their detail page", async ({
  page,
}) => {
  await signIn(page);
  const newest = Math.max(...fixture.orderIds);
  const widget = page.getByTestId("recent-orders");
  await expect(widget.getByText(`#${newest}`)).toBeVisible();
  await widget.getByRole("link", { name: `#${newest}` }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${newest}$`));
});

test("the sidebar link returns to the dashboard (the post-login landing route)", async ({
  page,
}) => {
  await signIn(page);
  // a full reload ends the in-memory session by design, so navigate inside the app
  await page
    .getByRole("link", { name: "الطلبات", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "لوحة التحكم" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("stat-cards")).toBeVisible();
});
