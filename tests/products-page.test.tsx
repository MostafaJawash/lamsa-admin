import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductsPage } from "@/pages/products";

import {
  brandsReply,
  categoriesReply,
  listItem,
  mockBackend,
  renderRoutes,
  type Handlers,
} from "./support/backend-mock";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const page = (items: unknown[], total = items.length, pageNumber = 1) => ({
  items,
  page: pageNumber,
  page_size: 20,
  total,
});

function baseHandlers(extra: Handlers = {}): Handlers {
  return {
    "GET /admin/products": () => ({ body: page([listItem()]) }),
    "GET /admin/categories": () => ({ body: categoriesReply }),
    "GET /admin/brands": () => ({ body: brandsReply }),
    ...extra,
  };
}

const routes = [{ path: "/products", element: <ProductsPage /> }];

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("products list", () => {
  it("shows skeleton rows while loading, then the rows from the API", async () => {
    mockBackend(baseHandlers());
    renderRoutes(routes, "/products");
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);

    expect(await screen.findByText("كريم الورد")).toBeInTheDocument();
    expect(screen.queryAllByTestId("skeleton-row")).toHaveLength(0);
    expect(screen.getByText("15,000 ل.س")).toBeInTheDocument();
    expect(screen.getByText("العناية بالبشرة")).toBeInTheDocument();
    expect(screen.getByText("لمسة")).toBeInTheDocument();
    expect(screen.getByText("نشط")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "إضافة منتج" })).toHaveAttribute(
      "href",
      "/products/new",
    );
  });

  it("shows 'من' before the lowest price of a variable product, in its own currency", async () => {
    mockBackend(
      baseHandlers({
        "GET /admin/products": () => ({
          body: page([
            listItem({
              type: "variable",
              currency: "USD",
              price_from: "8.50",
              stock: 30,
              is_active: false,
            }),
          ]),
        }),
      }),
    );
    renderRoutes(routes, "/products");
    expect(await screen.findByText("8.5 $")).toBeInTheDocument();
    expect(screen.getByText("من")).toBeInTheDocument();
    expect(screen.getByText("(متعدد)")).toBeInTheDocument();
    expect(screen.getByText("غير نشط")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockBackend(
      baseHandlers({ "GET /admin/products": () => ({ body: page([]) }) }),
    );
    renderRoutes(routes, "/products");
    expect(await screen.findByText("لا توجد منتجات")).toBeInTheDocument();
  });

  it("sends the URL's page and filters to the backend", async () => {
    const calls = mockBackend(baseHandlers());
    renderRoutes(
      routes,
      "/products?page=2&category=3&brand=2&status=inactive&sort=name",
    );
    await screen.findByText("كريم الورد");
    const request = calls.find((call) => call.path === "/admin/products");
    expect(request?.url.searchParams.get("page")).toBe("2");
    expect(request?.url.searchParams.get("page_size")).toBe("20");
    expect(request?.url.searchParams.get("category_id")).toBe("3");
    expect(request?.url.searchParams.get("brand_id")).toBe("2");
    expect(request?.url.searchParams.get("is_active")).toBe("false");
    expect(request?.url.searchParams.get("sort")).toBe("name");
  });

  it("typing in the search box updates the URL and queries again (back to page 1)", async () => {
    const calls = mockBackend(baseHandlers());
    const { router } = renderRoutes(routes, "/products?page=2");
    await screen.findByText("كريم الورد");

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "كريم" },
    });
    await waitFor(() => expect(router.state.location.search).toContain("q="));
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("q")).toBe("كريم");
    expect(params.get("page")).toBeNull();
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.path === "/admin/products" &&
            call.url.searchParams.get("q") === "كريم",
        ),
      ).toBe(true),
    );
  });

  it("pages through the server list and keeps the page in the URL", async () => {
    const calls = mockBackend(
      baseHandlers({
        "GET /admin/products": (request) => {
          const current = Number(
            new URL(request.url).searchParams.get("page") ?? 1,
          );
          return { body: page([listItem({ id: current })], 45, current) };
        },
      }),
    );
    const { router } = renderRoutes(routes, "/products");
    await screen.findByText("كريم الورد");
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));
    await waitFor(() => expect(router.state.location.search).toBe("?page=2"));
    await waitFor(() =>
      expect(
        calls.some((call) => call.url.searchParams.get("page") === "2"),
      ).toBe(true),
    );
  });

  it("asks for confirmation before deleting, and only then calls the API", async () => {
    const calls = mockBackend(
      baseHandlers({ "DELETE /admin/products/1": () => ({ status: 204 }) }),
    );
    renderRoutes(routes, "/products");
    await screen.findByText("كريم الورد");

    fireEvent.click(screen.getByRole("button", { name: /حذف: كريم الورد/ }));
    const dialog = await screen.findByRole("dialog");
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === "DELETE")).toBe(true),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حذف المنتج."),
    );
  });

  it("cancelling the dialog never calls the API", async () => {
    const calls = mockBackend(baseHandlers());
    renderRoutes(routes, "/products");
    await screen.findByText("كريم الورد");
    fireEvent.click(screen.getByRole("button", { name: /حذف: كريم الورد/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "إلغاء" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("shows the backend's own message when a product cannot be deleted", async () => {
    mockBackend(
      baseHandlers({
        "DELETE /admin/products/1": () => ({
          status: 409,
          body: {
            error: {
              code: "PRODUCT_HAS_ORDERS",
              message: "لا يمكن حذف منتج موجود في طلبات. أوقفه بدلًا من ذلك.",
              details: null,
            },
          },
        }),
      }),
    );
    renderRoutes(routes, "/products");
    await screen.findByText("كريم الورد");
    fireEvent.click(screen.getByRole("button", { name: /حذف: كريم الورد/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(toast.error.mock.calls[0]?.[0])).toContain(
      "لا يمكن حذف منتج موجود في طلبات",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
