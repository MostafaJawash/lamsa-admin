import { expect, test, type Page, type Route } from "@playwright/test";

import { loginViaApi } from "./support/backend.ts";
import { createOrders, type Fixture } from "./support/orders.ts";

/**
 * Phone-width smoke tests (375px, touch), run by the "mobile" project. Real :8001 backend as in
 * the other specs, except the notifications API, which is MOCKED IN THE BROWSER and never
 * reaches a backend (a send is real on the backend): see e2e/notifications.spec.ts.
 *
 * The two safety flows are only driven up to their confirmation gate here.
 */
const phone = () => process.env.E2E_ADMIN_PHONE as string;
const password = () => process.env.E2E_ADMIN_PASSWORD as string;
test.beforeEach(() =>
  test.skip(!process.env.E2E_ADMIN_PHONE, "backend on :8001 is not running"),
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
let fixture: Fixture;

test.beforeAll(async () => {
  if (!process.env.E2E_ADMIN_PHONE) return;
  const admin = await loginViaApi(phone(), password());
  fixture = await createOrders(admin.access_token, stamp, 1);
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("رقم الهاتف").fill(phone());
  await page.getByLabel("كلمة المرور").fill(password());
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** The session is in memory (a reload logs out), so move through the hamburger menu. */
async function openFromMenu(page: Page, link: string) {
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: link, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function expectNoPageScroll(page: Page) {
  const overflow = (await page.evaluate(
    "document.documentElement.scrollWidth - window.innerWidth",
  )) as number;
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

test("login works at phone width without sideways scrolling", async ({
  page,
}) => {
  await page.goto("/login");
  await expectNoPageScroll(page);
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoPageScroll(page);
});

test("the hamburger menu opens, a link navigates and the menu closes", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole("complementary")).toBeHidden(); // desktop sidebar is hidden
  await openFromMenu(page, "الطلبات");
  await expect(
    page.getByRole("heading", { name: "الطلبات", exact: true }),
  ).toBeVisible();
  await expectNoPageScroll(page);
});

test("products list: cards, no page scroll, data and actions reachable", async ({
  page,
}) => {
  await signIn(page);
  await openFromMenu(page, "المنتجات");
  await page.getByRole("searchbox").fill(fixture.productName);
  const card = page.getByRole("listitem").filter({
    hasText: fixture.productName,
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText("10,000 ل.س");
  await expect(card).toContainText("نشط");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expectNoPageScroll(page);

  // every action is on screen and finger-sized
  for (const name of [/تعديل:/, /تعديل المخزون/, /حذف/]) {
    const box = await card
      .getByRole("button", { name })
      .or(card.getByRole("link", { name }))
      .first()
      .boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(43.5);
    expect(box?.height).toBeGreaterThanOrEqual(43.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  }
});

test("product edit: fill and save at phone width", async ({ page }) => {
  const renamed = `${fixture.productName}-معدل`;
  await signIn(page);
  await openFromMenu(page, "المنتجات");
  await page.getByRole("searchbox").fill(fixture.productName);
  await page
    .getByRole("listitem")
    .filter({ hasText: fixture.productName })
    .getByRole("link", { name: /تعديل:/ })
    .click();
  await expect(page.getByLabel(/اسم المنتج/)).toHaveValue(fixture.productName);
  await expectNoPageScroll(page);

  await page.getByLabel(/اسم المنتج/).fill(renamed);
  await page.getByLabel(/^السعر/).fill("12500");
  await page.getByRole("button", { name: "حفظ" }).click();

  await expect(
    page.getByRole("heading", { name: "المنتجات", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill(renamed);
  const card = page.getByRole("listitem").filter({ hasText: renamed });
  await expect(card).toBeVisible();
  await expect(card).toContainText("12,500 ل.س");
});

test("customer reset-password: the typed-confirmation gate is readable and locked until the word is typed", async ({
  page,
}) => {
  await signIn(page);
  await openFromMenu(page, "العملاء");
  await page.getByRole("searchbox").fill(fixture.phone);
  await page
    .getByRole("link", { name: fixture.customerName, exact: true })
    .click();
  await page.getByRole("button", { name: "إعادة تعيين كلمة المرور" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("اكتب كلمة «تأكيد» لتفعيل الزر");
  await expectInsideViewport(page, "[data-slot=dialog-content]");
  const confirm = dialog.getByRole("button", {
    name: "إنشاء كلمة مرور مؤقتة",
  });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/اكتب كلمة/).fill("تأ");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/اكتب كلمة/).fill("تأكيد");
  await expect(confirm).toBeEnabled();
  // never click it: that would really reset the account's password
  const box = await confirm.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(43.5);
  await dialog.getByRole("button", { name: "إلغاء" }).click();
  await expect(dialog).toHaveCount(0);
});

const fakeNotification = {
  id: 777,
  type: "marketing",
  audience: "all",
  user_id: null,
  user_name: null,
  title: "عرض e2e",
  body: "نص e2e",
  link: { type: "none", value: null },
  status: "queued",
  scheduled_at: "2026-11-02T09:00:00",
  sent_at: null,
  created_at: "2026-11-02T09:00:00",
  created_by_user_id: 1,
  created_by_name: "e2e",
  recipients_count: 0,
  success_count: 0,
  failure_count: 0,
  deferred_by_quiet_hours: false,
};

test("broadcast: the send gate is readable at phone width and nothing reaches a backend", async ({
  page,
}) => {
  const sent: string[] = [];
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  // Every notifications call is answered here and never forwarded (no route.continue()).
  await page.route(/\/api\/v1\/admin\/notifications(\/|\?|$)/, (route) => {
    const request = route.request();
    if (request.method() !== "GET") sent.push(request.method());
    if (request.method() === "GET")
      return json(route, 200, { items: [], page: 1, page_size: 20, total: 0 });
    return json(route, 201, fakeNotification);
  });

  await signIn(page);
  await openFromMenu(page, "الإشعارات");
  await page.getByRole("link", { name: "إشعار جديد" }).click();
  await expect(page.getByTestId("real-send-warning")).toBeVisible();
  await expectNoPageScroll(page);

  await page.getByLabel(/عنوان الإشعار/).fill("عرض e2e");
  await page.getByLabel(/نص الإشعار/).fill("نص e2e");
  await page.getByRole("button", { name: "مراجعة وإرسال" }).click();

  const dialog = page.getByRole("dialog");
  await expectInsideViewport(page, "[data-slot=dialog-content]");
  await expect(dialog.getByTestId("push-preview")).toContainText("عرض e2e");
  await expect(dialog).toContainText("جميع العملاء");
  const confirm = dialog.getByRole("button", { name: "إرسال إلى الجميع" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/للتأكيد اكتب العبارة/).fill("إرسال");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/للتأكيد اكتب العبارة/).fill("إرسال للجميع");
  await expect(confirm).toBeEnabled();
  // stop at the gate
  expect(sent).toEqual([]);
  await dialog.getByRole("button", { name: "تراجع" }).click();
  expect(sent).toEqual([]);
});
