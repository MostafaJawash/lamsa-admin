import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrdersPage } from "@/pages/orders";

import {
  mockBackend,
  renderRoutes,
  type Handlers,
} from "./support/backend-mock";
import {
  deliveryMethods,
  emptyStats,
  orderSummary,
} from "./support/orders-fixtures";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const page = (items: unknown[], total = items.length, pageNumber = 1) => ({
  items,
  page: pageNumber,
  page_size: 20,
  total,
});

function handlers(extra: Handlers = {}): Handlers {
  return {
    "GET /admin/orders": () => ({ body: page([orderSummary()]) }),
    "GET /admin/orders/stats": () => ({ body: emptyStats }),
    "GET /admin/delivery-methods": () => ({ body: deliveryMethods }),
    ...extra,
  };
}

const routes = [{ path: "/orders", element: <OrdersPage /> }];

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("orders list", () => {
  it("shows skeletons, then rows with customer, date, items, per-currency totals, delivery and status", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/orders");
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);

    const row = (await screen.findByText("#101")).closest("tr") as HTMLElement;
    expect(within(row).getByText("رنا الأحمد")).toBeInTheDocument();
    expect(within(row).getByText("+963933123456")).toBeInTheDocument();
    expect(within(row).getByText("01/11/2026 13:30")).toBeInTheDocument();
    expect(within(row).getByText("2 قطعة")).toBeInTheDocument();
    // two currencies, shown separately and never summed
    expect(within(row).getByText("55,000 ل.س")).toBeInTheDocument();
    expect(within(row).getByText("9 $")).toBeInTheDocument();
    expect(within(row).getByText("توصيل دمشق")).toBeInTheDocument();
    expect(within(row).getByText("تم استلام طلبك")).toHaveAttribute(
      "data-status",
      "pending",
    );
    expect(
      within(row).getByRole("link", { name: /عرض التفاصيل/ }),
    ).toHaveAttribute("href", "/orders/101");
  });

  it("colors each status through its own tone", async () => {
    mockBackend(
      handlers({
        "GET /admin/orders": () => ({
          body: page([
            orderSummary({
              id: 1,
              status: "delivered",
              status_label: "تم التوصيل",
            }),
            orderSummary({ id: 2, status: "cancelled", status_label: "ملغى" }),
          ]),
        }),
      }),
    );
    renderRoutes(routes, "/orders");
    expect(await screen.findByText("تم التوصيل")).toHaveClass("text-ok");
    expect(screen.getByText("ملغى")).toHaveClass("text-danger");
  });

  it("shows the empty state", async () => {
    mockBackend(handlers({ "GET /admin/orders": () => ({ body: page([]) }) }));
    renderRoutes(routes, "/orders");
    expect(await screen.findByText("لا توجد طلبات")).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    let fail = true;
    mockBackend(
      handlers({
        "GET /admin/orders": () =>
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
            : { body: page([orderSummary()]) },
      }),
    );
    renderRoutes(routes, "/orders");
    expect(await screen.findByText("عطل مؤقت")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByText("#101")).toBeInTheDocument();
  });

  it("sends the URL's filters, dates, sort and page to the backend", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(
      routes,
      "/orders?page=2&status=shipped&delivery=damascus_courier&from=2026-10-01&to=2026-10-31&sort=total_desc&q=0933",
    );
    await screen.findByText("#101");
    const query = calls.find((call) => call.path === "/admin/orders")?.url
      .searchParams;
    expect(query?.get("page")).toBe("2");
    expect(query?.get("page_size")).toBe("20");
    expect(query?.get("status")).toBe("shipped");
    expect(query?.get("delivery_method")).toBe("damascus_courier");
    expect(query?.get("date_from")).toBe("2026-10-01");
    expect(query?.get("date_to")).toBe("2026-10-31");
    expect(query?.get("sort")).toBe("total_desc");
    expect(query?.get("q")).toBe("0933");
  });

  it("typing in the search box updates the URL, returns to page 1 and queries again", async () => {
    const calls = mockBackend(handlers());
    const { router } = renderRoutes(routes, "/orders?page=3");
    await screen.findByText("#101");
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
            c.path === "/admin/orders" &&
            c.url.searchParams.get("q") === "0933",
        ),
      ).toBe(true),
    );
  });

  it("choosing a date updates the URL and the query", async () => {
    const calls = mockBackend(handlers());
    const { router } = renderRoutes(routes, "/orders");
    await screen.findByText("#101");
    fireEvent.change(screen.getByLabelText("من تاريخ"), {
      target: { value: "2026-10-05" },
    });
    await waitFor(() =>
      expect(router.state.location.search).toBe("?from=2026-10-05"),
    );
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.searchParams.get("date_from") === "2026-10-05"),
      ).toBe(true),
    );
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });

  it("pages through the server list and keeps the page in the URL", async () => {
    const calls = mockBackend(
      handlers({
        "GET /admin/orders": (request) => {
          const current = Number(
            new URL(request.url).searchParams.get("page") ?? 1,
          );
          return {
            body: page([orderSummary({ id: 200 + current })], 45, current),
          };
        },
      }),
    );
    const { router } = renderRoutes(routes, "/orders");
    await screen.findByText("#201");
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));
    await waitFor(() => expect(router.state.location.search).toBe("?page=2"));
    await waitFor(() =>
      expect(calls.some((c) => c.url.searchParams.get("page") === "2")).toBe(
        true,
      ),
    );
  });

  it("the stats strip shows counts from the stats endpoint and filters by status on click", async () => {
    const calls = mockBackend(handlers());
    const { router } = renderRoutes(routes, "/orders");
    const tile = await screen.findByRole("button", { name: /طلبات جديدة/ });
    expect(within(tile).getByText("3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /قيد التجهيز/ }),
    ).toHaveTextContent("2");
    fireEvent.click(tile);
    await waitFor(() =>
      expect(router.state.location.search).toBe("?status=pending"),
    );
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.searchParams.get("status") === "pending"),
      ).toBe(true),
    );
    expect(tile).toHaveAttribute("aria-pressed", "true");
  });
});
