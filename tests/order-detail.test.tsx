import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderDetailPage } from "@/pages/orders/order-detail-page";

import {
  mockBackend,
  renderRoutes,
  type Handlers,
} from "./support/backend-mock";
import { governorates, orderDetail } from "./support/orders-fixtures";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const routes = [{ path: "/orders/:id", element: <OrderDetailPage /> }];

function handlers(order = orderDetail(), extra: Handlers = {}): Handlers {
  return {
    "GET /admin/orders/101": () => ({ body: order }),
    "GET /governorates": () => ({ body: governorates }),
    ...extra,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open(order = orderDetail(), extra: Handlers = {}) {
  const calls = mockBackend(handlers(order, extra));
  const view = renderRoutes(routes, "/orders/101");
  await screen.findByRole("heading", { level: 1, name: /الطلب/ });
  return { calls, ...view };
}

describe("order detail", () => {
  it("shows the customer, the stored address with the governorate name and the map link", async () => {
    await open();
    expect(screen.getByText("رنا الأحمد")).toBeInTheDocument();
    expect(screen.getByText("+963933123456")).toBeInTheDocument();
    await screen.findByText("حلب، الفرقان");
    expect(screen.getByText("قرب الحديقة العامة")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /فتح الموقع/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps?q=36.2,37.1",
    );
    expect(screen.getByText("اتصلوا قبل الوصول")).toBeInTheDocument();
    expect(screen.getByText(/كل عام وأنتِ بخير/)).toBeInTheDocument();
    expect(screen.getByText("الدفع عند الاستلام")).toBeInTheDocument();
  });

  it("links the customer's name to their customer page", async () => {
    await open();
    const link = screen.getByRole("link", { name: "رنا الأحمد" });
    expect(link).toHaveAttribute("href", "/customers/7");
  });

  it("shows the carrier-paid note and per-currency totals as separate blocks, never summed", async () => {
    await open();
    expect(
      screen.getByText(/تُدفع أجرة الشحن إلى شركة الشحن مباشرة/),
    ).toBeInTheDocument();
    const syp = document.querySelector('[data-currency="SYP"]') as HTMLElement;
    const usd = document.querySelector('[data-currency="USD"]') as HTMLElement;
    expect(within(syp).getAllByText("55,000 ل.س").length).toBeGreaterThan(0);
    expect(within(syp).getByText("40,000 ل.س")).toBeInTheDocument();
    expect(within(usd).getAllByText("9 $").length).toBeGreaterThan(0);
    expect(within(syp).queryByText(/\$/)).toBeNull();
  });

  it("lists each item in its own currency, linking products that still exist", async () => {
    await open();
    const cream = screen.getByRole("link", { name: "كريم الورد" });
    expect(cream).toHaveAttribute("href", "/products/5/edit");
    expect(screen.getByText("50 ml")).toBeInTheDocument();
    expect(screen.getByText("عطر الياسمين").tagName).toBe("SPAN");
  });

  it("shows the timeline steps (reached or not) and the history with who and when", async () => {
    await open();
    const steps = document.querySelectorAll("ol > li");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByText("لم يصل بعد")).toHaveLength(3);
    expect(screen.getByText(/بواسطة رنا الأحمد/)).toBeInTheDocument();
  });

  it("shows a cancelled order's reason and offers no actions", async () => {
    await open(
      orderDetail({
        status: "cancelled",
        status_label: "ملغى",
        can_cancel: false,
        allowed_next_statuses: [],
        timeline: [
          {
            status: "pending",
            label: "تم استلام طلبك",
            reached_at: "2026-11-01T10:30:00Z",
            is_current: false,
            cancel_reason: null,
          },
          {
            status: "cancelled",
            label: "ملغى",
            reached_at: "2026-11-01T12:00:00Z",
            is_current: true,
            cancel_reason: "العميل لم يرد",
          },
        ],
      } as never),
    );
    expect(screen.getByText(/العميل لم يرد/)).toBeInTheDocument();
    expect(
      screen.getByText("لا توجد إجراءات متاحة لهذا الطلب."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "إلغاء الطلب" })).toBeNull();
  });

  it("shows a not-found state for an unknown order", async () => {
    mockBackend({
      "GET /admin/orders/101": () => ({
        status: 404,
        body: {
          error: {
            code: "ORDER_NOT_FOUND",
            message: "الطلب غير موجود.",
            details: null,
          },
        },
      }),
    });
    renderRoutes(routes, "/orders/101");
    expect(await screen.findByText("الطلب غير موجود.")).toBeInTheDocument();
  });

  it("treats a non-numeric id as not found without calling the API", async () => {
    const calls = mockBackend({});
    renderRoutes(routes, "/orders/abc");
    expect(await screen.findByText("الطلب غير موجود.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe("status actions only offer what the backend allows", () => {
  it("pending: only 'بدء التجهيز' (plus cancel)", async () => {
    await open();
    expect(
      screen.getByRole("button", { name: "بدء التجهيز" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تم الشحن" })).toBeNull();
    expect(screen.queryByRole("button", { name: "تم التوصيل" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "إلغاء الطلب" }),
    ).toBeInTheDocument();
  });

  it("shipped: only 'تم التوصيل'", async () => {
    await open(
      orderDetail({
        status: "shipped",
        allowed_next_statuses: ["delivered"],
      } as never),
    );
    expect(
      screen.getByRole("button", { name: "تم التوصيل" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "بدء التجهيز" })).toBeNull();
  });

  it("a pickup order's last step reads 'تم الاستلام'", async () => {
    await open(
      orderDetail({
        status: "ready_for_pickup",
        shipping_address: null,
        allowed_next_statuses: ["delivered"],
      } as never),
    );
    expect(
      screen.getByRole("button", { name: "تم الاستلام" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("استلام من المتجر (بدون عنوان)"),
    ).toBeInTheDocument();
  });

  it("delivered: no buttons at all", async () => {
    await open(
      orderDetail({
        status: "delivered",
        can_cancel: false,
        allowed_next_statuses: [],
      } as never),
    );
    expect(screen.queryByRole("button", { name: "بدء التجهيز" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إلغاء الطلب" })).toBeNull();
  });
});

describe("changing the status", () => {
  it("asks for confirmation, calls the API only after it, then shows the server's new state", async () => {
    const moved = orderDetail({
      status: "preparing",
      status_label: "قيد التجهيز",
      allowed_next_statuses: ["shipped"],
    } as never);
    const { calls } = await open(orderDetail(), {
      "POST /admin/orders/101/status": () => ({ body: moved }),
    });

    fireEvent.click(screen.getByRole("button", { name: "بدء التجهيز" }));
    const dialog = await screen.findByRole("dialog");
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    fireEvent.change(within(dialog).getByLabelText(/ملاحظة/), {
      target: { value: "جاهز غداً" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "تأكيد" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم تغيير حالة الطلب."),
    );
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/admin/orders/101/status");
    expect(post?.body).toEqual({ to_status: "preparing", note: "جاهز غداً" });
    // the next step is now the offered one
    expect(
      await screen.findByRole("button", { name: "تم الشحن" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "بدء التجهيز" })).toBeNull();
  });

  it("cancelling the dialog never calls the API", async () => {
    const { calls } = await open();
    fireEvent.click(screen.getByRole("button", { name: "بدء التجهيز" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "إلغاء" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows the backend's message when the move is rejected", async () => {
    await open(orderDetail(), {
      "POST /admin/orders/101/status": () => ({
        status: 422,
        body: {
          error: {
            code: "INVALID_STATUS_TRANSITION",
            message: "لا يمكن نقل الطلب إلى هذه الحالة.",
            details: null,
          },
        },
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "بدء التجهيز" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "تأكيد",
      }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "لا يمكن نقل الطلب إلى هذه الحالة.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("cancelling", () => {
  it("is separate, explains stock restoration, and calls the API only after a reason and a confirmation", async () => {
    const cancelled = orderDetail({
      status: "cancelled",
      status_label: "ملغى",
      can_cancel: false,
      allowed_next_statuses: [],
    } as never);
    const { calls } = await open(orderDetail(), {
      "POST /admin/orders/101/cancel": () => ({ body: cancelled }),
    });

    fireEvent.click(screen.getByRole("button", { name: "إلغاء الطلب" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/سيُعاد مخزون المنتجات/),
    ).toBeInTheDocument();
    // pending orders cannot keep stock (the backend only allows that for shipped ones)
    expect(within(dialog).queryByRole("checkbox")).toBeNull();

    // no reason: nothing is sent
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إلغاء الطلب" }),
    );
    expect(
      await within(dialog).findByText(/3 أحرف على الأقل/),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    fireEvent.change(within(dialog).getByLabelText(/سبب الإلغاء/), {
      target: { value: "العميل لم يرد" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إلغاء الطلب" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم إلغاء الطلب."),
    );
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      reason: "العميل لم يرد",
      restore_stock: true,
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "إلغاء الطلب" })).toBeNull(),
    );
  });

  it("lets a shipped order keep its stock out (lost goods), and sends restore_stock=false", async () => {
    const { calls } = await open(
      orderDetail({
        status: "shipped",
        allowed_next_statuses: ["delivered"],
      } as never),
      {
        "POST /admin/orders/101/cancel": () => ({
          body: orderDetail({
            status: "cancelled",
            can_cancel: false,
            allowed_next_statuses: [],
          } as never),
        }),
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "إلغاء الطلب" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(within(dialog).getByText(/لن يُعاد المخزون/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/سبب الإلغاء/), {
      target: { value: "بضاعة مفقودة" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إلغاء الطلب" }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST")).toBe(true),
    );
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      reason: "بضاعة مفقودة",
      restore_stock: false,
    });
  });

  it("going back never calls the API", async () => {
    const { calls } = await open();
    fireEvent.click(screen.getByRole("button", { name: "إلغاء الطلب" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "تراجع" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows the backend's message when the order can no longer be cancelled", async () => {
    await open(orderDetail(), {
      "POST /admin/orders/101/cancel": () => ({
        status: 409,
        body: {
          error: {
            code: "ORDER_NOT_CANCELLABLE",
            message: "لا يمكن إلغاء هذا الطلب الآن.",
            details: null,
          },
        },
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "إلغاء الطلب" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/سبب الإلغاء/), {
      target: { value: "سبب" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إلغاء الطلب" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("لا يمكن إلغاء هذا الطلب الآن."),
    );
  });
});
