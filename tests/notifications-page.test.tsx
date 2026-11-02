import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  renderHook,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BROADCAST_PHRASE,
  BroadcastCooldownError,
  cooldownRemainingMs,
  resetBroadcastCooldown,
  type AdminNotification,
} from "@/features/notifications";
import { useCreateNotification } from "@/features/notifications/api";
import { toStoreInput } from "@/lib/dates";
import { NotificationsPage } from "@/pages/notifications";
import { NotificationComposePage } from "@/pages/notifications/compose-page";
import { NotificationDetailPage } from "@/pages/notifications/notification-detail-page";

import {
  mockBackend,
  renderRoutes,
  type Handlers,
  type RecordedCall,
} from "./support/backend-mock";
import { brand, categoryTree } from "./support/catalog-fixtures";

/*
 * Every test here runs against a mocked fetch: nothing reaches a real backend, so nothing can
 * reach a real device. `sent()` is the list of POSTs that would have sent or scheduled a push.
 */

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

function notification(
  over: Partial<AdminNotification> & { id: number },
): AdminNotification {
  return {
    type: "marketing",
    audience: "all",
    user_id: null,
    user_name: null,
    title: `إشعار ${over.id}`,
    body: `نص ${over.id}`,
    link: { type: "none", value: null },
    status: "sent",
    scheduled_at: "2026-11-01T09:00:00",
    sent_at: "2026-11-01T09:00:05",
    created_at: "2026-11-01T08:59:00",
    created_by_user_id: 1,
    created_by_name: "المدير",
    recipients_count: 120,
    success_count: 118,
    failure_count: 2,
    deferred_by_quiet_hours: false,
    ...over,
  };
}

const page = (items: unknown[]) => ({
  items,
  page: 1,
  page_size: 20,
  total: items.length,
});

const customer = {
  id: 5,
  name: "سارة أحمد",
  phone: "+963933111222",
  email: null,
  role: "customer",
  is_active: true,
};

function handlers(extra: Handlers = {}): Handlers {
  return {
    "GET /admin/notifications": () => ({
      body: page([
        notification({ id: 3, title: "عرض الجمعة", body: "خصم 20% على الكل" }),
        notification({
          id: 2,
          audience: "user",
          user_id: 5,
          user_name: "سارة أحمد",
          type: "message",
          title: "طلبك جاهز",
          status: "scheduled",
          sent_at: null,
          recipients_count: 0,
          success_count: 0,
          failure_count: 0,
          deferred_by_quiet_hours: true,
        }),
        notification({
          id: 1,
          title: "ملغى",
          status: "cancelled",
          sent_at: null,
        }),
      ]),
    }),
    "GET /admin/users": () => ({ body: page([customer]) }),
    "GET /admin/categories": () => ({ body: categoryTree }),
    "GET /admin/brands": () => ({
      body: page([brand({ id: 1, name: "لمسة", slug: "lamsa" })]),
    }),
    "GET /admin/products": () => ({ body: page([]) }),
    ...extra,
  };
}

const routes = [
  { path: "/notifications", element: <NotificationsPage /> },
  { path: "/notifications/new", element: <NotificationComposePage /> },
  { path: "/notifications/:id", element: <NotificationDetailPage /> },
];

const sent = (calls: RecordedCall[]) =>
  calls.filter((c) => c.method === "POST" && c.path === "/admin/notifications");

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetBroadcastCooldown();
});

describe("history", () => {
  it("lists date, message preview, audience, status and delivery numbers", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/notifications");
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);
    const sentRow = (await screen.findByText("عرض الجمعة")).closest(
      "tr",
    ) as HTMLElement;
    expect(within(sentRow).getByText("خصم 20% على الكل")).toBeInTheDocument();
    expect(within(sentRow).getByText("جميع العملاء")).toBeInTheDocument();
    expect(within(sentRow).getByText("تم الإرسال")).toBeInTheDocument();
    expect(within(sentRow).getByText("01/11/2026 12:00")).toBeInTheDocument();
    expect(
      within(sentRow).getByText("المستلمون: 120 · نجح: 118 · فشل: 2"),
    ).toBeInTheDocument();

    const scheduled = screen
      .getByText("طلبك جاهز")
      .closest("tr") as HTMLElement;
    expect(within(scheduled).getByText("سارة أحمد")).toBeInTheDocument();
    expect(within(scheduled).getByText("مجدول")).toBeInTheDocument();
    expect(
      within(scheduled).getByText("مؤجل لانتهاء ساعات الهدوء"),
    ).toBeInTheDocument();
    expect(within(scheduled).getByText("—")).toBeInTheDocument();
    expect(
      within(
        screen
          .getByText("ملغى", { selector: "span.truncate" })
          .closest("tr") as HTMLElement,
      ).getByText("ملغى", { selector: "[data-slot=badge]" }),
    ).toBeInTheDocument();
  });

  it("sends the URL's page, status and audience to the backend", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/notifications?page=2&status=sent&audience=user");
    await screen.findByText("عرض الجمعة");
    const query = calls.find((c) => c.path === "/admin/notifications")?.url
      .searchParams;
    expect(query?.get("page")).toBe("2");
    expect(query?.get("status")).toBe("sent");
    expect(query?.get("audience")).toBe("user");
  });

  it("shows the empty state", async () => {
    mockBackend(
      handlers({ "GET /admin/notifications": () => ({ body: page([]) }) }),
    );
    renderRoutes(routes, "/notifications");
    expect(await screen.findByText("لا توجد إشعارات")).toBeInTheDocument();
  });

  it("opens a campaign from its row", async () => {
    mockBackend(
      handlers({
        "GET /admin/notifications/3": () => ({
          body: notification({ id: 3, title: "عرض الجمعة" }),
        }),
      }),
    );
    renderRoutes(routes, "/notifications");
    fireEvent.click(await screen.findByRole("link", { name: /عرض الجمعة/ }));
    expect(await screen.findByTestId("delivery-stats")).toHaveTextContent(
      "118",
    );
  });
});

async function openCompose(extra: Handlers = {}) {
  const calls = mockBackend(handlers(extra));
  const view = renderRoutes(routes, "/notifications/new");
  await screen.findByTestId("real-send-warning");
  return { calls, ...view };
}

function fillMessage(title = "عرض الجمعة", body = "خصم 20% على كل المنتجات") {
  fireEvent.change(screen.getByLabelText(/عنوان الإشعار/), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText(/نص الإشعار/), {
    target: { value: body },
  });
}

const review = () =>
  fireEvent.click(screen.getByRole("button", { name: "مراجعة وإرسال" }));

describe("compose: what is offered", () => {
  it("shows the static real-send warning and only the real audiences", async () => {
    await openCompose();
    expect(screen.getByTestId("real-send-warning")).toHaveTextContent(
      "هذا الإجراء يرسل إشعارات حقيقية",
    );
    expect(
      screen.getAllByRole("radio", { name: /جميع العملاء|عميل واحد/ }),
    ).toHaveLength(2);
    // no invented segments
    expect(screen.queryByText(/سلة|متروك|شريحة|segment/i)).toBeNull();
  });

  it("does not open the send gate while the message is invalid", async () => {
    const { calls } = await openCompose();
    review();
    expect(await screen.findByText("أدخل عنوان الإشعار.")).toBeInTheDocument();
    expect(screen.getByText("أدخل نص الإشعار.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent(calls)).toHaveLength(0);
  });

  it("limits the title to 150 and the body to 500 characters", async () => {
    await openCompose();
    fillMessage("ا".repeat(151), "ب".repeat(501));
    review();
    expect(
      await screen.findByText("العنوان لا يتجاوز 150 حرفاً."),
    ).toBeInTheDocument();
    expect(screen.getByText("النص لا يتجاوز 500 حرف.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("broadcast send gate", () => {
  it("shows the exact preview, keeps Send disabled until the phrase is typed, then sends the exact payload once", async () => {
    const { calls } = await openCompose({
      "POST /admin/notifications": () => ({
        status: 201,
        body: notification({ id: 40, title: "عرض الجمعة" }),
      }),
      "GET /admin/notifications/40": () => ({
        body: notification({ id: 40, title: "عرض الجمعة" }),
      }),
    });
    fillMessage();
    review();
    const dialog = await screen.findByRole("dialog");
    // the preview: exactly what will be sent, and to whom
    const preview = within(dialog).getByTestId("push-preview");
    expect(preview).toHaveTextContent("عرض الجمعة");
    expect(preview).toHaveTextContent("خصم 20% على كل المنتجات");
    expect(dialog).toHaveTextContent("جميع العملاء");
    expect(dialog).toHaveTextContent("فوراً");
    expect(dialog).toHaveTextContent("لا يمكن سحبه");

    const confirm = within(dialog).getByRole("button", {
      name: "إرسال إلى الجميع",
    });
    expect(confirm).toBeDisabled();
    const input = within(dialog).getByLabelText(new RegExp(BROADCAST_PHRASE));
    fireEvent.change(input, { target: { value: "إرسال" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "send to all" } });
    expect(confirm).toBeDisabled();
    // Enter in the box must not bypass the gate either
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(sent(calls)).toHaveLength(0);

    fireEvent.change(input, { target: { value: BROADCAST_PHRASE } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    fireEvent.click(confirm); // a nervous double click

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم إنشاء الإشعار."),
    );
    expect(sent(calls)).toHaveLength(1);
    expect(sent(calls)[0]?.body).toEqual({
      audience: "all",
      title: "عرض الجمعة",
      body: "خصم 20% على كل المنتجات",
    });
    // after sending, the campaign's own page opens
    expect(await screen.findByTestId("delivery-stats")).toBeInTheDocument();
  });

  it("closing the dialog sends nothing and the phrase must be typed again next time", async () => {
    const { calls } = await openCompose();
    fillMessage();
    review();
    let dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText(new RegExp(BROADCAST_PHRASE)),
      {
        target: { value: BROADCAST_PHRASE },
      },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "تراجع" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    review();
    dialog = await screen.findByRole("dialog");
    expect(
      (
        within(dialog).getByLabelText(
          new RegExp(BROADCAST_PHRASE),
        ) as HTMLInputElement
      ).value,
    ).toBe("");
    expect(
      within(dialog).getByRole("button", { name: "إرسال إلى الجميع" }),
    ).toBeDisabled();
    expect(sent(calls)).toHaveLength(0);
  });

  it("locks broadcasting for 30 seconds after a broadcast was accepted", async () => {
    const { calls, router } = await openCompose({
      "POST /admin/notifications": () => ({
        status: 201,
        body: notification({ id: 40 }),
      }),
      "GET /admin/notifications/40": () => ({
        body: notification({ id: 40 }),
      }),
    });
    fillMessage();
    review();
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText(new RegExp(BROADCAST_PHRASE)),
      {
        target: { value: BROADCAST_PHRASE },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إرسال إلى الجميع" }),
    );
    await screen.findByTestId("delivery-stats");

    // back to the compose page (a fresh form): the lock is still on
    await router.navigate("/notifications/new");
    await screen.findByTestId("real-send-warning");
    fillMessage();
    const button = screen.getByRole("button", { name: "مراجعة وإرسال" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/تم إرسال إشعار للجميع للتو. يمكن الإرسال مجدداً بعد/),
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent(calls)).toHaveLength(1);
  });

  it("unlocks after the 30 seconds have passed", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now");
    clock.mockReturnValue(now);
    const { router } = await openCompose({
      "POST /admin/notifications": () => ({
        status: 201,
        body: notification({ id: 40 }),
      }),
      "GET /admin/notifications/40": () => ({ body: notification({ id: 40 }) }),
    });
    fillMessage();
    review();
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText(new RegExp(BROADCAST_PHRASE)),
      {
        target: { value: BROADCAST_PHRASE },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إرسال إلى الجميع" }),
    );
    await screen.findByTestId("delivery-stats");
    await router.navigate("/notifications/new");
    await screen.findByTestId("real-send-warning");
    expect(
      screen.getByRole("button", { name: "مراجعة وإرسال" }),
    ).toBeDisabled();

    clock.mockReturnValue(now + 29_000);
    await router.navigate("/notifications"); // leave, so the form mounts afresh
    await screen.findByText("سجل الإشعارات");
    await router.navigate("/notifications/new");
    await screen.findByTestId("real-send-warning");
    expect(
      screen.getByRole("button", { name: "مراجعة وإرسال" }),
    ).toBeDisabled();

    clock.mockReturnValue(now + 30_500);
    await router.navigate("/notifications");
    await screen.findByText("سجل الإشعارات");
    await router.navigate("/notifications/new");
    await screen.findByTestId("real-send-warning");
    expect(screen.getByRole("button", { name: "مراجعة وإرسال" })).toBeEnabled();
    clock.mockRestore();
  });

  it("does not start the lock when the backend refuses", async () => {
    await openCompose({
      "POST /admin/notifications": () => ({
        status: 422,
        body: {
          error: {
            code: "INVALID_LINK",
            message: "الرابط غير صالح.",
            details: { reason: "no such slug" },
          },
        },
      }),
    });
    fillMessage();
    review();
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText(new RegExp(BROADCAST_PHRASE)),
      {
        target: { value: BROADCAST_PHRASE },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إرسال إلى الجميع" }),
    );
    expect(await screen.findByText("الرابط غير صالح.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "مراجعة وإرسال" })).toBeEnabled();
  });

  it("a scheduled broadcast needs the same phrase and sends the UTC schedule", async () => {
    const { calls } = await openCompose({
      "POST /admin/notifications": () => ({
        status: 201,
        body: notification({ id: 41, status: "scheduled" }),
      }),
      "GET /admin/notifications/41": () => ({
        body: notification({ id: 41, status: "scheduled", sent_at: null }),
      }),
    });
    fillMessage();
    fireEvent.click(screen.getByRole("radio", { name: "جدولة" }));
    const tomorrow = toStoreInput(
      new Date(Date.now() + 86_400_000).toISOString(),
    );
    fireEvent.change(screen.getByLabelText("موعد الإرسال"), {
      target: { value: tomorrow },
    });
    review();
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "جدولة الإرسال للجميع" }),
    ).toBeDisabled();
    fireEvent.change(
      within(dialog).getByLabelText(new RegExp(BROADCAST_PHRASE)),
      {
        target: { value: BROADCAST_PHRASE },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "جدولة الإرسال للجميع" }),
    );
    await waitFor(() => expect(sent(calls)).toHaveLength(1));
    const body = sent(calls)[0]?.body as { scheduled_at: string };
    expect(body).toMatchObject({ audience: "all", title: "عرض الجمعة" });
    expect(Date.parse(body.scheduled_at)).toBeGreaterThan(Date.now());
    expect(body.scheduled_at.endsWith("Z")).toBe(true);
  });

  it("rejects a schedule outside 1 minute - 90 days before the gate opens", async () => {
    await openCompose();
    fillMessage();
    fireEvent.click(screen.getByRole("radio", { name: "جدولة" }));
    fireEvent.change(screen.getByLabelText("موعد الإرسال"), {
      target: { value: "2020-01-01T10:00" },
    });
    review();
    expect(
      await screen.findByText(/بين دقيقة واحدة و90 يوماً/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("single customer send", () => {
  it("needs a customer, then a plain confirmation (no phrase) and sends user_id", async () => {
    const { calls } = await openCompose({
      "POST /admin/notifications": () => ({
        status: 201,
        body: notification({
          id: 42,
          audience: "user",
          user_id: 5,
          type: "message",
        }),
      }),
      "GET /admin/notifications/42": () => ({
        body: notification({
          id: 42,
          audience: "user",
          user_id: 5,
          type: "message",
        }),
      }),
    });
    fireEvent.click(screen.getByRole("radio", { name: "عميل واحد" }));
    fillMessage("طلبك جاهز", "يمكنك استلام طلبك");
    review();
    expect(await screen.findByText("اختر العميل.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "سارة" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /سارة أحمد/ }));
    review();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("سارة أحمد");
    expect(
      within(dialog).queryByLabelText(new RegExp(BROADCAST_PHRASE)),
    ).toBeNull();
    const confirm = within(dialog).getByRole("button", {
      name: "إرسال إلى العميل",
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(sent(calls)).toHaveLength(1));
    expect(sent(calls)[0]?.body).toEqual({
      audience: "user",
      user_id: 5,
      title: "طلبك جاهز",
      body: "يمكنك استلام طلبك",
    });
    await screen.findByTestId("delivery-stats");

    // a single-customer send does not start the broadcast lock
  });

  it("is not locked by the broadcast cooldown", async () => {
    const { startBroadcastCooldown } = await import("@/features/notifications");
    startBroadcastCooldown();
    await openCompose();
    fireEvent.click(screen.getByRole("radio", { name: "عميل واحد" }));
    expect(screen.getByRole("button", { name: "مراجعة وإرسال" })).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: "جميع العملاء" }));
    expect(
      screen.getByRole("button", { name: "مراجعة وإرسال" }),
    ).toBeDisabled();
  });
});

describe("test push", () => {
  it("pushes only through /admin/notifications/test and shows the per-device result", async () => {
    const { calls } = await openCompose({
      "POST /admin/notifications/test": () => ({
        body: {
          devices: 2,
          results: [
            { token: "abcdefghijkl…", ok: true, code: "OK", detail: null },
            {
              token: "zzzzzzzzzzzz…",
              ok: false,
              code: "UNREGISTERED",
              detail: "x",
            },
          ],
        },
      }),
    });
    fillMessage("تجربة", "نص تجريبي");
    fireEvent.click(
      screen.getByRole("button", { name: "إرسال تجربة إلى أجهزتي" }),
    );
    expect(await screen.findByText(/UNREGISTERED/)).toBeInTheDocument();
    expect(screen.getByText("وصل")).toBeInTheDocument();
    expect(screen.getByText("فشل")).toBeInTheDocument();
    expect(
      calls.find((c) => c.path === "/admin/notifications/test")?.body,
    ).toEqual({ title: "تجربة", body: "نص تجريبي" });
    expect(sent(calls)).toHaveLength(0);
  });

  it("says when the admin has no registered device", async () => {
    await openCompose({
      "POST /admin/notifications/test": () => ({
        body: { devices: 0, results: [] },
      }),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "إرسال تجربة إلى أجهزتي" }),
    );
    expect(await screen.findByText(/لا توجد أجهزة مسجلة/)).toBeInTheDocument();
  });
});

describe("scheduled campaign actions", () => {
  const scheduledAll = notification({
    id: 7,
    status: "scheduled",
    sent_at: null,
    scheduled_at: "2026-12-01T07:00:00",
    recipients_count: 0,
    success_count: 0,
    failure_count: 0,
  });

  it("send-now of a scheduled broadcast needs the phrase and calls send-now once", async () => {
    const calls = mockBackend(
      handlers({
        "GET /admin/notifications/7": () => ({ body: scheduledAll }),
        "POST /admin/notifications/7/send-now": () => ({
          body: { ...scheduledAll, status: "queued" },
        }),
      }),
    );
    renderRoutes(routes, "/notifications/7");
    fireEvent.click(await screen.findByRole("button", { name: "إرسال الآن" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", {
      name: "إرسال إلى الجميع",
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(
      within(dialog).getByLabelText(new RegExp(BROADCAST_PHRASE)),
      {
        target: { value: BROADCAST_PHRASE },
      },
    );
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("بدأ الإرسال."),
    );
    expect(
      calls.filter((c) => c.path === "/admin/notifications/7/send-now"),
    ).toHaveLength(1);
  });

  it("send-now of a scheduled single-customer message needs only a confirmation", async () => {
    const message = {
      ...scheduledAll,
      audience: "user" as const,
      user_id: 5,
      user_name: "سارة أحمد",
    };
    const calls = mockBackend(
      handlers({
        "GET /admin/notifications/7": () => ({ body: message }),
        "POST /admin/notifications/7/send-now": () => ({ body: message }),
      }),
    );
    renderRoutes(routes, "/notifications/7");
    fireEvent.click(await screen.findByRole("button", { name: "إرسال الآن" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByLabelText(new RegExp(BROADCAST_PHRASE)),
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إرسال إلى العميل" }),
    );
    await waitFor(() =>
      expect(
        calls.some((c) => c.path === "/admin/notifications/7/send-now"),
      ).toBe(true),
    );
  });

  it("cancels after a confirmation, and edits with PATCH sending only a changed time", async () => {
    const calls = mockBackend(
      handlers({
        "GET /admin/notifications/7": () => ({ body: scheduledAll }),
        "POST /admin/notifications/7/cancel": () => ({
          body: { ...scheduledAll, status: "cancelled" },
        }),
        "PATCH /admin/notifications/7": () => ({ body: scheduledAll }),
      }),
    );
    renderRoutes(routes, "/notifications/7");
    fireEvent.click(await screen.findByRole("button", { name: "تعديل" }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/عنوان الإشعار/), {
      target: { value: "عنوان معدّل" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حفظ التعديلات."),
    );
    const patch = calls.find((c) => c.method === "PATCH")?.body as Record<
      string,
      unknown
    >;
    expect(patch).toMatchObject({ title: "عنوان معدّل" });
    expect(patch).not.toHaveProperty("scheduled_at");

    fireEvent.click(screen.getByRole("button", { name: "إلغاء الإرسال" }));
    dialog = await screen.findByRole("dialog");
    expect(calls.some((c) => c.path.endsWith("/cancel"))).toBe(false);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إلغاء الإشعار" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم إلغاء الإشعار."),
    );
    expect(
      calls.filter((c) => c.path === "/admin/notifications/7/cancel"),
    ).toHaveLength(1);
  });

  it("offers no actions once a campaign is sent", async () => {
    mockBackend(
      handlers({
        "GET /admin/notifications/3": () => ({ body: notification({ id: 3 }) }),
      }),
    );
    renderRoutes(routes, "/notifications/3");
    await screen.findByTestId("delivery-stats");
    expect(screen.queryByRole("button", { name: "إرسال الآن" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إلغاء الإرسال" })).toBeNull();
  });

  it("shows a not-found state for an unknown campaign", async () => {
    mockBackend(
      handlers({
        "GET /admin/notifications/99": () => ({
          status: 404,
          body: { error: { code: "NOTIFICATION_NOT_FOUND", message: "x" } },
        }),
      }),
    );
    renderRoutes(routes, "/notifications/99");
    expect(await screen.findByText("الإشعار غير موجود.")).toBeInTheDocument();
  });
});

describe("broadcast guard below the UI", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );

  it("lets only one of two simultaneous broadcast requests through, then locks", async () => {
    const calls = mockBackend({
      "POST /admin/notifications": () => ({
        status: 201,
        body: notification({ id: 50 }),
      }),
    });
    const { result } = renderHook(() => useCreateNotification(), { wrapper });
    const body = { audience: "all", title: "t", body: "b" } as const;
    const first = result.current.mutateAsync(body);
    const second = result.current.mutateAsync(body);
    await expect(second).rejects.toBeInstanceOf(BroadcastCooldownError);
    await expect(first).resolves.toMatchObject({ id: 50 });
    // accepted: the 30 s lock is on, a third attempt never reaches the network
    await expect(result.current.mutateAsync(body)).rejects.toBeInstanceOf(
      BroadcastCooldownError,
    );
    expect(sent(calls)).toHaveLength(1);
  });

  it("does not lock messages to a single customer", async () => {
    const calls = mockBackend({
      "POST /admin/notifications": () => ({
        status: 201,
        body: notification({ id: 51, audience: "user" }),
      }),
    });
    const { result } = renderHook(() => useCreateNotification(), { wrapper });
    const body = {
      audience: "user",
      user_id: 5,
      title: "t",
      body: "b",
    } as const;
    await result.current.mutateAsync(body);
    await result.current.mutateAsync(body);
    expect(sent(calls)).toHaveLength(2);
    expect(cooldownRemainingMs()).toBe(0);
  });
});
