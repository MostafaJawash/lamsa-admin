import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "@/pages/dashboard";

import {
  mockBackend,
  renderRoutes,
  type Handlers,
} from "./support/backend-mock";
import { emptyStats, orderSummary } from "./support/orders-fixtures";

const stats = {
  ...emptyStats,
  orders_count: 12,
  counts: { ...emptyStats.counts, delivered: 5, cancelled: 1 },
  delivered_revenue: [
    { currency: "SYP", amount: "250000.00" },
    { currency: "USD", amount: "40.00" },
  ],
  average_order_value: [
    { currency: "SYP", amount: "50000.00" },
    { currency: "USD", amount: "8.00" },
  ],
  cancelled_rate: 0.0833,
  top_products: [
    { product_id: 9, name: "كريم الورد", quantity: 14 },
    { product_id: null, name: "منتج محذوف", quantity: 3 },
  ],
};

const lowStock = (total = 2) => ({
  items: [
    {
      product_id: 4,
      product_name: "سيروم",
      product_slug: "serum",
      variant_id: 40,
      variant_label: "30 مل",
      sku: "LM-4-1",
      stock: 0,
    },
    {
      product_id: 5,
      product_name: "عطر",
      product_slug: "perfume",
      variant_id: null,
      variant_label: null,
      sku: "LM-5",
      stock: 2,
    },
  ],
  page: 1,
  page_size: 5,
  total,
});

const orders = {
  items: [orderSummary()],
  page: 1,
  page_size: 5,
  total: 1,
};

function handlers(extra: Handlers = {}): Handlers {
  return {
    "GET /admin/orders/stats": () => ({ body: stats }),
    "GET /admin/products/low-stock": () => ({ body: lowStock() }),
    "GET /admin/orders": () => ({ body: orders }),
    ...extra,
  };
}

const failing = {
  status: 500,
  body: { error: { code: "INTERNAL_ERROR", message: "x" } },
};

const routes = [
  { path: "/", element: <DashboardPage /> },
  { path: "/orders", element: <p>orders list</p> },
  { path: "/orders/:id", element: <p>order detail</p> },
  { path: "/products", element: <p>products list</p> },
  { path: "/products/:id/edit", element: <p>product edit</p> },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("dashboard", () => {
  it("fires exactly three requests on load, with the intended parameters", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/");
    await screen.findByTestId("stat-cards");
    await screen.findByText("#101");
    await screen.findByText("سيروم");
    expect(calls.map((c) => `${c.method} ${c.path}`).sort()).toEqual([
      "GET /admin/orders",
      "GET /admin/orders/stats",
      "GET /admin/products/low-stock",
    ]);
    const recent = calls.find((c) => c.path === "/admin/orders");
    expect(recent?.url.searchParams.get("page_size")).toBe("5");
    expect(recent?.url.searchParams.get("sort")).toBe("newest");
    const low = calls.find((c) => c.path === "/admin/products/low-stock");
    expect(low?.url.searchParams.get("threshold")).toBeNull();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("shows skeletons first", () => {
    mockBackend(handlers());
    renderRoutes(routes, "/");
    expect(screen.getByTestId("stat-cards-loading")).toBeInTheDocument();
    expect(screen.getByTestId("low-stock-loading")).toBeInTheDocument();
    expect(screen.getByTestId("recent-orders-loading")).toBeInTheDocument();
  });

  it("renders the stat cards, revenue and average per currency, never summed", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/");
    const cards = await screen.findByTestId("stat-cards");
    expect(
      within(screen.getByTestId("stat-pending")).getByText("3"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("stat-preparing")).getByText("2"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("stat-shipped")).getByText("1"),
    ).toBeInTheDocument();
    const revenue = screen.getByTestId("stat-revenue");
    expect(within(revenue).getByText("250,000 ل.س")).toBeInTheDocument();
    expect(within(revenue).getByText("40 $")).toBeInTheDocument();
    const average = screen.getByTestId("stat-average");
    expect(within(average).getByText("50,000 ل.س")).toBeInTheDocument();
    expect(within(average).getByText("8 $")).toBeInTheDocument();
    expect(within(cards).getByText("8.33٪")).toBeInTheDocument();
  });

  it("shows a no-revenue hint when nothing was delivered", async () => {
    mockBackend(
      handlers({
        "GET /admin/orders/stats": () => ({
          body: { ...stats, delivered_revenue: [], average_order_value: [] },
        }),
      }),
    );
    renderRoutes(routes, "/");
    const revenue = await screen.findByTestId("stat-revenue");
    expect(
      within(revenue).getByText("لا توجد طلبات مُسلَّمة بعد"),
    ).toBeInTheDocument();
  });

  it("renders low stock, recent orders and top products from mocked data", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/");
    const low = await screen.findByTestId("low-stock");
    await within(low).findByText("سيروم");
    expect(within(low).getByText(/30 مل/)).toBeInTheDocument();
    expect(within(low).getByText("المتبقي: 0")).toBeInTheDocument();
    expect(within(low).getByText("عطر")).toBeInTheDocument();
    // total (2) does not exceed what is shown (5): no "view all"
    expect(within(low).queryByText("عرض الكل")).toBeNull();

    const recent = screen.getByTestId("recent-orders");
    await within(recent).findByText("#101");
    expect(within(recent).getByText("رنا الأحمد")).toBeInTheDocument();
    expect(within(recent).getByText("55,000 ل.س")).toBeInTheDocument();
    expect(within(recent).getByText("9 $")).toBeInTheDocument();

    const top = await screen.findByTestId("top-products");
    expect(within(top).getByText("كريم الورد")).toBeInTheDocument();
    expect(within(top).getByText("14 قطعة")).toBeInTheDocument();
    // an item whose product is gone has no link
    expect(within(top).getByText("منتج محذوف").closest("a")).toBeNull();
  });

  it("shows empty messages", async () => {
    mockBackend(
      handlers({
        "GET /admin/orders/stats": () => ({
          body: { ...stats, top_products: [] },
        }),
        "GET /admin/products/low-stock": () => ({ body: lowStockEmpty }),
        "GET /admin/orders": () => ({
          body: { ...orders, items: [], total: 0 },
        }),
      }),
    );
    renderRoutes(routes, "/");
    expect(
      await screen.findByText("لا توجد منتجات منخفضة المخزون."),
    ).toBeInTheDocument();
    expect(await screen.findByText("لا توجد طلبات بعد.")).toBeInTheDocument();
    expect(
      await screen.findByText("لا توجد مبيعات مُسلَّمة بعد."),
    ).toBeInTheDocument();
  });

  it("one widget failing leaves the rest rendered, and retry recovers it", async () => {
    let healthy = false;
    mockBackend(
      handlers({
        "GET /admin/products/low-stock": () =>
          healthy ? { body: lowStock() } : failing,
      }),
    );
    renderRoutes(routes, "/");
    const low = await screen.findByTestId("low-stock");
    await within(low).findByRole("alert");
    // everything else is fine
    expect(await screen.findByTestId("stat-cards")).toBeInTheDocument();
    expect(await screen.findByText("#101")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("top-products")).getByText("كريم الورد"),
    ).toBeInTheDocument();

    healthy = true;
    fireEvent.click(
      within(low).getByRole("button", { name: "إعادة المحاولة" }),
    );
    expect(await within(low).findByText("سيروم")).toBeInTheDocument();
  });

  it("a failing recent-orders call or stats call does not break the other widgets", async () => {
    mockBackend(handlers({ "GET /admin/orders": () => failing }));
    renderRoutes(routes, "/");
    await within(await screen.findByTestId("recent-orders")).findByRole(
      "alert",
    );
    expect(await screen.findByTestId("stat-cards")).toBeInTheDocument();
    expect(await screen.findByText("سيروم")).toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    mockBackend(handlers({ "GET /admin/orders/stats": () => failing }));
    renderRoutes(routes, "/");
    expect(await screen.findByText("#101")).toBeInTheDocument();
    expect(await screen.findByText("سيروم")).toBeInTheDocument();
    expect(screen.queryByTestId("stat-cards")).toBeNull();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("links the status cards to the pre-filtered orders list", async () => {
    mockBackend(handlers());
    const targets: Record<string, string> = {
      "stat-pending": "/orders?status=pending",
      "stat-preparing": "/orders?status=preparing",
      "stat-shipped": "/orders?status=shipped",
      "stat-revenue": "/orders?status=delivered",
      "stat-average": "/orders?status=delivered",
      "stat-cancelled-rate": "/orders?status=cancelled",
    };
    for (const [id, to] of Object.entries(targets)) {
      const { router, unmount } = renderRoutes(routes, "/");
      fireEvent.click(await screen.findByTestId(id));
      await waitFor(() =>
        expect(
          router.state.location.pathname + router.state.location.search,
        ).toBe(to),
      );
      unmount();
      cleanup();
    }
  });

  it("links rows to the product edit page and the order detail page", async () => {
    mockBackend(handlers());
    let view = renderRoutes(routes, "/");
    fireEvent.click(await screen.findByText("سيروم"));
    await waitFor(() =>
      expect(view.router.state.location.pathname).toBe("/products/4/edit"),
    );
    view.unmount();
    cleanup();

    view = renderRoutes(routes, "/");
    fireEvent.click(await screen.findByText("#101"));
    await waitFor(() =>
      expect(view.router.state.location.pathname).toBe("/orders/101"),
    );
    view.unmount();
    cleanup();

    view = renderRoutes(routes, "/");
    fireEvent.click(await screen.findByText("كريم الورد"));
    await waitFor(() =>
      expect(view.router.state.location.pathname).toBe("/products/9/edit"),
    );
  });

  it("offers 'view all' for low stock only when more exist than shown, pointing at the stock-sorted products list", async () => {
    mockBackend(
      handlers({
        "GET /admin/products/low-stock": () => ({ body: lowStock(23) }),
      }),
    );
    const { router } = renderRoutes(routes, "/");
    const low = await screen.findByTestId("low-stock");
    fireEvent.click(await within(low).findByText("عرض الكل"));
    await waitFor(() =>
      expect(
        router.state.location.pathname + router.state.location.search,
      ).toBe("/products?sort=stock_asc"),
    );
  });
});

const lowStockEmpty = { items: [], page: 1, page_size: 5, total: 0 };
