import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Customer } from "@/features/customers";
import { CustomersPage } from "@/pages/customers";
import { CustomerDetailPage } from "@/pages/customers/customer-detail-page";

import {
  mockBackend,
  renderRoutes,
  type Handlers,
} from "./support/backend-mock";
import {
  governorates,
  orderDetail,
  orderSummary,
} from "./support/orders-fixtures";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: 7,
    name: "رنا الأحمد",
    phone: "+963933123456",
    email: null,
    role: "customer",
    auth_provider: "phone",
    must_change_password: false,
    created_at: "2026-11-01T10:30:00Z",
    is_active: true,
    last_login_at: null,
    orders_count: 2,
    ...over,
  } as Customer;
}

const page = (items: unknown[], total = items.length, pageNumber = 1) => ({
  items,
  page: pageNumber,
  page_size: 20,
  total,
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("customers list", () => {
  const routes = [{ path: "/customers", element: <CustomersPage /> }];
  const handlers = (extra: Handlers = {}): Handlers => ({
    "GET /admin/users": () => ({
      body: page([
        customer(),
        customer({
          id: 8,
          name: "سامر",
          phone: "+963944000111",
          email: "samer@example.com",
          auth_provider: "google",
          is_active: false,
          orders_count: 0,
        }),
      ]),
    }),
    ...extra,
  });

  it("shows skeletons, then name, phone, email, date, order count, account type and status", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/customers");
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);

    const rana = (
      await screen.findByRole("link", { name: "رنا الأحمد" })
    ).closest("tr") as HTMLElement;
    expect(within(rana).getByText("+963933123456")).toBeInTheDocument();
    expect(within(rana).getByText("—")).toBeInTheDocument(); // no email
    expect(within(rana).getByText("01/11/2026 13:30")).toBeInTheDocument();
    expect(within(rana).getByText("2")).toBeInTheDocument();
    expect(within(rana).getByText("هاتف وكلمة مرور")).toBeInTheDocument();
    expect(within(rana).getByText("نشط")).toBeInTheDocument();
    expect(
      within(rana).getByRole("link", { name: /عرض التفاصيل/ }),
    ).toHaveAttribute("href", "/customers/7");

    const samer = screen
      .getByRole("link", { name: "سامر" })
      .closest("tr") as HTMLElement;
    expect(within(samer).getByText("samer@example.com")).toBeInTheDocument();
    expect(within(samer).getByText("حساب Google")).toBeInTheDocument();
    expect(within(samer).getByText("معطّل")).toBeInTheDocument();
  });

  it("always asks for customers only, with no role filter in the UI", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(
      routes,
      "/customers?page=2&q=%D8%B1%D9%86%D8%A7&status=inactive",
    );
    await screen.findByRole("link", { name: "رنا الأحمد" });
    const query = calls.find((c) => c.path === "/admin/users")?.url
      .searchParams;
    expect(query?.get("role")).toBe("customer");
    expect(query?.get("page")).toBe("2");
    expect(query?.get("page_size")).toBe("20");
    expect(query?.get("search")).toBe("رنا");
    expect(query?.get("is_active")).toBe("false");
    expect(screen.queryByRole("combobox", { name: /الدور|role/i })).toBeNull();
  });

  it("typing in the search box updates the URL, returns to page 1 and queries again", async () => {
    const calls = mockBackend(handlers());
    const { router } = renderRoutes(routes, "/customers?page=3");
    await screen.findByRole("link", { name: "رنا الأحمد" });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "0933" },
    });
    await waitFor(() =>
      expect(router.state.location.search).toContain("q=0933"),
    );
    expect(
      new URLSearchParams(router.state.location.search).get("page"),
    ).toBeNull();
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.path === "/admin/users" &&
            c.url.searchParams.get("search") === "0933",
        ),
      ).toBe(true),
    );
  });

  it("pages through the server list and keeps the page in the URL", async () => {
    const calls = mockBackend(
      handlers({
        "GET /admin/users": (request) => {
          const current = Number(
            new URL(request.url).searchParams.get("page") ?? 1,
          );
          return {
            body: page(
              [customer({ id: 100 + current, name: `عميل ${current}` })],
              45,
              current,
            ),
          };
        },
      }),
    );
    const { router } = renderRoutes(routes, "/customers");
    await screen.findByRole("link", { name: "عميل 1" });
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));
    await waitFor(() => expect(router.state.location.search).toBe("?page=2"));
    await waitFor(() =>
      expect(calls.some((c) => c.url.searchParams.get("page") === "2")).toBe(
        true,
      ),
    );
  });

  it("shows the empty state", async () => {
    mockBackend(handlers({ "GET /admin/users": () => ({ body: page([]) }) }));
    renderRoutes(routes, "/customers");
    expect(await screen.findByText("لا يوجد عملاء")).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    let fail = true;
    mockBackend(
      handlers({
        "GET /admin/users": () =>
          fail
            ? {
                status: 500,
                body: {
                  error: {
                    code: "INTERNAL_ERROR",
                    message: "عطل مؤقت",
                    details: null,
                  },
                },
              }
            : { body: page([customer()]) },
      }),
    );
    renderRoutes(routes, "/customers");
    expect(await screen.findByText("عطل مؤقت")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(
      await screen.findByRole("link", { name: "رنا الأحمد" }),
    ).toBeInTheDocument();
  });
});

describe("customer detail", () => {
  const routes = [{ path: "/customers/:id", element: <CustomerDetailPage /> }];

  function handlers(
    who: Customer = customer(),
    extra: Handlers = {},
  ): Handlers {
    return {
      "GET /admin/users/7": () => ({ body: who }),
      "GET /admin/orders": () => ({
        body: page([
          orderSummary(),
          orderSummary({
            id: 102,
            status: "preparing",
            status_label: "قيد التجهيز",
          }),
        ]),
      }),
      "GET /admin/orders/101": () => ({ body: orderDetail() }),
      "GET /governorates": () => ({ body: governorates }),
      ...extra,
    };
  }

  async function open(who = customer(), extra: Handlers = {}) {
    const calls = mockBackend(handlers(who, extra));
    const view = renderRoutes(routes, "/customers/7");
    await screen.findByRole("heading", { level: 1, name: who.name });
    return { calls, ...view };
  }

  it("shows the profile: phone, email, registration, last login, account type, status, order count", async () => {
    await open(
      customer({
        email: "rana@example.com",
        last_login_at: "2026-11-02T08:00:00Z",
        must_change_password: true,
      }),
    );
    expect(screen.getByText("+963933123456")).toBeInTheDocument();
    expect(screen.getByText("rana@example.com")).toBeInTheDocument();
    expect(screen.getByText("01/11/2026 13:30")).toBeInTheDocument();
    expect(screen.getByText("02/11/2026 11:00")).toBeInTheDocument();
    expect(screen.getByText("هاتف وكلمة مرور")).toBeInTheDocument();
    expect(
      screen.getByText("كلمة مرور مؤقتة بانتظار التغيير"),
    ).toBeInTheDocument();
  });

  it("says when a customer never logged in", async () => {
    await open();
    expect(screen.getByText("لم يسجّل الدخول بعد")).toBeInTheDocument();
  });

  it("lists the customer's orders found by phone, each linking to the order, without a customer column", async () => {
    const { calls } = await open();
    const link = await screen.findByRole("link", { name: "#101" });
    expect(link).toHaveAttribute("href", "/orders/101");
    expect(screen.getByRole("link", { name: "#102" })).toHaveAttribute(
      "href",
      "/orders/102",
    );
    const query = calls.find((c) => c.path === "/admin/orders")?.url
      .searchParams;
    expect(query?.get("q")).toBe("963933123456");
    expect(query?.get("sort")).toBe("newest");
    expect(screen.queryByRole("columnheader", { name: "العميل" })).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: "رقم الطلب" }),
    ).toBeInTheDocument();
    // per-currency totals, never summed
    const row = link.closest("tr") as HTMLElement;
    expect(within(row).getByText("55,000 ل.س")).toBeInTheDocument();
    expect(within(row).getByText("9 $")).toBeInTheDocument();
    expect(
      screen.getByText(/قد لا تظهر الطلبات التي أُنشئت قبل تغيير رقمه/),
    ).toBeInTheDocument();
  });

  it("shows the latest order's stored address, labelled as an order's snapshot", async () => {
    await open();
    expect(await screen.findByText("حلب، الفرقان")).toBeInTheDocument();
    expect(screen.getByText("عنوان آخر طلب")).toBeInTheDocument();
    expect(screen.getByText(/وليس عناوين العميل الحالية/)).toBeInTheDocument();
  });

  it("without orders there is no address to show and the history is empty", async () => {
    await open(customer({ orders_count: 0 }), {
      "GET /admin/orders": () => ({ body: page([]) }),
    });
    expect(
      await screen.findByText("لا توجد طلبات لهذا العميل."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("لا توجد طلبات، فلا يوجد عنوان لعرضه."),
    ).toBeInTheDocument();
  });

  it("shows not-found for an unknown customer", async () => {
    mockBackend({
      "GET /admin/users/7": () => ({
        status: 404,
        body: {
          error: {
            code: "USER_NOT_FOUND",
            message: "العميل غير موجود.",
            details: null,
          },
        },
      }),
    });
    renderRoutes(routes, "/customers/7");
    expect(await screen.findByText("العميل غير موجود.")).toBeInTheDocument();
  });

  it("treats a non-numeric id as not found without calling the API", async () => {
    const calls = mockBackend({});
    renderRoutes(routes, "/customers/abc");
    expect(await screen.findByText("العميل غير موجود.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("an admin account is read-only: a notice, no actions, no orders or address lookups", async () => {
    const { calls } = await open(customer({ role: "admin", name: "المدير" }));
    expect(screen.getByRole("note")).toHaveTextContent(
      "حسابات الإدارة لا تُدار من هذه الصفحة",
    );
    expect(screen.queryByRole("button", { name: "تعطيل الحساب" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "إعادة تعيين كلمة المرور" }),
    ).toBeNull();
    expect(calls.some((c) => c.path === "/admin/orders")).toBe(false);
  });
});

describe("account actions", () => {
  const routes = [{ path: "/customers/:id", element: <CustomerDetailPage /> }];

  function handlers(who: Customer, extra: Handlers = {}): Handlers {
    return {
      "GET /admin/users/7": () => ({ body: who }),
      "GET /admin/orders": () => ({ body: page([]) }),
      "GET /governorates": () => ({ body: governorates }),
      ...extra,
    };
  }

  async function open(who: Customer, extra: Handlers = {}) {
    const calls = mockBackend(handlers(who, extra));
    renderRoutes(routes, "/customers/7");
    await screen.findByRole("heading", { level: 1, name: who.name });
    return calls;
  }

  it("deactivating asks first, explains the effects, and PATCHes only is_active after confirming", async () => {
    const calls = await open(customer(), {
      "PATCH /admin/users/7": () => ({ body: customer({ is_active: false }) }),
    });
    fireEvent.click(screen.getByRole("button", { name: "تعطيل الحساب" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/ستنتهي جلسات العميل فوراً/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/طلباته الحالية وعناوينه لا تتأثر/),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "تعطيل" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم تعطيل الحساب."),
    );
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.path).toBe("/admin/users/7");
    expect(patch?.body).toEqual({ is_active: false });
    // the page now shows the server's answer: inactive, with "activate" offered
    expect(
      await screen.findByRole("button", { name: "تفعيل الحساب" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("معطّل").length).toBeGreaterThan(0);
  });

  it("activating also asks first, then sends is_active true", async () => {
    const calls = await open(customer({ is_active: false }), {
      "PATCH /admin/users/7": () => ({ body: customer() }),
    });
    fireEvent.click(screen.getByRole("button", { name: "تفعيل الحساب" }));
    const dialog = await screen.findByRole("dialog");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "تفعيل" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم تفعيل الحساب."),
    );
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      is_active: true,
    });
  });

  it("cancelling the dialog never calls the API", async () => {
    const calls = await open(customer());
    fireEvent.click(screen.getByRole("button", { name: "تعطيل الحساب" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "إلغاء",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("shows the backend's message when it refuses", async () => {
    await open(customer(), {
      "PATCH /admin/users/7": () => ({
        status: 422,
        body: {
          error: {
            code: "CANNOT_MODIFY_SELF",
            message: "لا يمكنك تعطيل حسابك بنفسك.",
            details: null,
          },
        },
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "تعطيل الحساب" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "تعطيل",
      }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("لا يمكنك تعطيل حسابك بنفسك."),
    );
  });

  describe("reset password", () => {
    const reset = {
      "POST /admin/users/7/reset-password": () => ({
        body: { temporary_password: "Ab3dE6gH9j" },
      }),
    };

    it("needs the typed word before the button activates, and calls nothing until then", async () => {
      const calls = await open(customer(), reset);
      fireEvent.click(
        screen.getByRole("button", { name: "إعادة تعيين كلمة المرور" }),
      );
      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", {
        name: "إنشاء كلمة مرور مؤقتة",
      });
      expect(confirm).toBeDisabled();
      expect(
        within(dialog).getByText(/لا يمكن التراجع عن هذه الخطوة/),
      ).toBeInTheDocument();

      const field = within(dialog).getByLabelText(/اكتب كلمة/);
      fireEvent.change(field, { target: { value: "تاكيد" } }); // wrong spelling
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(calls.some((c) => c.method === "POST")).toBe(false);

      fireEvent.change(field, { target: { value: "تأكيد" } });
      expect(confirm).toBeEnabled();
    });

    it("shows the temporary password once, then forgets it when the dialog closes", async () => {
      const calls = await open(customer(), reset);
      fireEvent.click(
        screen.getByRole("button", { name: "إعادة تعيين كلمة المرور" }),
      );
      let dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText(/اكتب كلمة/), {
        target: { value: "تأكيد" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "إنشاء كلمة مرور مؤقتة" }),
      );

      expect(
        await within(dialog).findByTestId("temporary-password"),
      ).toHaveTextContent("Ab3dE6gH9j");
      expect(within(dialog).getByText(/لن تُعرض مرة أخرى/)).toBeInTheDocument();
      expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);

      // the dialog's own corner "X" shares the label; use the footer button
      const closeButton = within(dialog)
        .getAllByRole("button", { name: "إغلاق" })
        .find((button) => !button.querySelector(".sr-only"));
      fireEvent.click(closeButton as HTMLElement);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.queryByText("Ab3dE6gH9j")).toBeNull();

      // reopening starts over: the word is needed again and the old password is gone
      fireEvent.click(
        screen.getByRole("button", { name: "إعادة تعيين كلمة المرور" }),
      );
      dialog = await screen.findByRole("dialog");
      expect(within(dialog).queryByTestId("temporary-password")).toBeNull();
      expect(
        within(dialog).getByRole("button", { name: "إنشاء كلمة مرور مؤقتة" }),
      ).toBeDisabled();
    });

    it("cancelling never calls the API", async () => {
      const calls = await open(customer(), reset);
      fireEvent.click(
        screen.getByRole("button", { name: "إعادة تعيين كلمة المرور" }),
      );
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "إلغاء",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(calls.some((c) => c.method === "POST")).toBe(false);
    });

    it("is not offered for a Google account, with the reason", async () => {
      await open(customer({ auth_provider: "google" }), reset);
      expect(
        screen.queryByRole("button", { name: "إعادة تعيين كلمة المرور" }),
      ).toBeNull();
      expect(
        screen.getByText("حساب Google لا يملك كلمة مرور لإعادة تعيينها."),
      ).toBeInTheDocument();
    });

    it("shows the backend's message if the reset is refused", async () => {
      await open(customer(), {
        "POST /admin/users/7/reset-password": () => ({
          status: 422,
          body: {
            error: {
              code: "NOT_A_PASSWORD_ACCOUNT",
              message: "هذا الحساب لا يملك كلمة مرور.",
              details: null,
            },
          },
        }),
      });
      fireEvent.click(
        screen.getByRole("button", { name: "إعادة تعيين كلمة المرور" }),
      );
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText(/اكتب كلمة/), {
        target: { value: "تأكيد" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "إنشاء كلمة مرور مؤقتة" }),
      );
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "هذا الحساب لا يملك كلمة مرور.",
        ),
      );
      expect(screen.queryByTestId("temporary-password")).toBeNull();
    });
  });
});
