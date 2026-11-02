import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Notifications: the send gate, with the notifications API MOCKED IN THE BROWSER.
 *
 * Sending is real on the backend (POST /admin/notifications pushes to customers' devices when
 * the backend runs PUSH_BACKEND=firebase), so this suite never lets any /admin/notifications
 * request reach a backend, not even lamsa_test: `blockNotificationsApi` fulfills every such
 * request itself and never calls route.continue(). The rest of the app (login, the customers
 * search) still talks to the real :8001 backend, read-only. What this proves: the send button
 * stays disabled until the phrase is typed, the exact payload that WOULD be sent, the preview,
 * and the 30-second broadcast lock. It does NOT prove a real push is delivered: real-send e2e
 * coverage is deliberately skipped (README "Notifications: why real sends are not in e2e").
 */
const phone = () => process.env.E2E_ADMIN_PHONE as string;
const password = () => process.env.E2E_ADMIN_PASSWORD as string;
test.beforeEach(() =>
  test.skip(!process.env.E2E_ADMIN_PHONE, "backend on :8001 is not running"),
);
test.describe.configure({ mode: "serial" });

type Captured = { method: string; path: string; body: unknown };

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

/** Answers every notifications admin call locally. There is deliberately no fallback to the network. */
async function blockNotificationsApi(page: Page): Promise<Captured[]> {
  const captured: Captured[] = [];
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  await page.route(/\/api\/v1\/admin\/notifications(\/|\?|$)/, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    captured.push({
      method: request.method(),
      path,
      body: request.postDataJSON(),
    });
    if (request.method() === "POST" && path === "/admin/notifications")
      return json(route, 201, fakeNotification);
    if (request.method() === "POST" && path === "/admin/notifications/test")
      return json(route, 200, { devices: 0, results: [] });
    if (request.method() === "GET" && path === "/admin/notifications")
      return json(route, 200, { items: [], page: 1, page_size: 20, total: 0 });
    if (request.method() === "GET" && path === "/admin/notifications/777")
      return json(route, 200, fakeNotification);
    return json(route, 404, { error: { code: "NOT_FOUND", message: "mock" } });
  });
  return captured;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("رقم الهاتف").fill(phone());
  await page.getByLabel("كلمة المرور").fill(password());
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

const sends = (captured: Captured[]) =>
  captured.filter(
    (c) => c.method === "POST" && c.path === "/admin/notifications",
  );

test("broadcast: Send stays locked until the phrase is typed; the exact payload goes out once; the lock follows", async ({
  page,
}) => {
  const captured = await blockNotificationsApi(page);
  await signIn(page);
  await page
    .getByRole("link", { name: "الإشعارات", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "سجل الإشعارات" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "إشعار جديد" }).click();

  await expect(page.getByTestId("real-send-warning")).toContainText(
    "هذا الإجراء يرسل إشعارات حقيقية",
  );
  await page.getByLabel(/عنوان الإشعار/).fill("عرض e2e");
  await page.getByLabel(/نص الإشعار/).fill("نص e2e");
  await page.getByRole("button", { name: "مراجعة وإرسال" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("push-preview")).toContainText("عرض e2e");
  await expect(dialog).toContainText("جميع العملاء");
  const confirm = dialog.getByRole("button", { name: "إرسال إلى الجميع" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/للتأكيد اكتب العبارة/).fill("إرسال");
  await expect(confirm).toBeDisabled();
  expect(sends(captured)).toHaveLength(0);

  await dialog.getByLabel(/للتأكيد اكتب العبارة/).fill("إرسال للجميع");
  await expect(confirm).toBeEnabled();
  expect(sends(captured)).toHaveLength(0); // typing alone sends nothing
  await confirm.dblclick(); // a nervous double click

  await expect(page).toHaveURL(/\/notifications\/777$/);
  expect(sends(captured)).toHaveLength(1);
  expect(sends(captured)[0]?.body).toEqual({
    audience: "all",
    title: "عرض e2e",
    body: "نص e2e",
  });

  // the 30 s broadcast lock survives leaving and coming back (in-memory, same page session)
  await page.getByRole("link", { name: "العودة إلى السجل" }).click();
  await page.getByRole("link", { name: "إشعار جديد" }).click();
  await page.getByLabel(/عنوان الإشعار/).fill("عرض ثانٍ");
  await page.getByLabel(/نص الإشعار/).fill("نص ثانٍ");
  await expect(
    page.getByRole("button", { name: "مراجعة وإرسال" }),
  ).toBeDisabled();
  await expect(page.getByText(/يمكن الإرسال مجدداً بعد/)).toBeVisible();
  expect(sends(captured)).toHaveLength(1);
});

test("test push goes to /admin/notifications/test only and never creates a campaign", async ({
  page,
}) => {
  const captured = await blockNotificationsApi(page);
  await signIn(page);
  await page
    .getByRole("link", { name: "الإشعارات", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "إشعار جديد" }).click();
  await page.getByRole("button", { name: "إرسال تجربة إلى أجهزتي" }).click();
  await expect
    .poll(() => captured.some((c) => c.path === "/admin/notifications/test"))
    .toBe(true);
  expect(sends(captured)).toHaveLength(0);
});
