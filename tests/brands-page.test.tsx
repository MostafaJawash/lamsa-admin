import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrandsPage } from "@/pages/brands";

import {
  mockBackend,
  renderRoutes,
  urls,
  type Handlers,
} from "./support/backend-mock";
import { brand } from "./support/catalog-fixtures";

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

const rows = [
  brand({
    id: 1,
    name: "لمسة",
    slug: "lamsa",
    is_own_brand: true,
    product_count: 12,
    logo: urls,
  }),
  brand({
    id: 2,
    name: "روز",
    slug: "rose",
    is_active: false,
    product_count: 0,
  }),
];

function handlers(extra: Handlers = {}): Handlers {
  return { "GET /admin/brands": () => ({ body: page(rows) }), ...extra };
}

const routes = [{ path: "/brands", element: <BrandsPage /> }];

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("brands list", () => {
  it("shows skeletons, then logo, name, slug, status and product count", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/brands");
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);
    const row = (
      await screen.findByText("لمسة", { selector: "button" })
    ).closest("tr") as HTMLElement;
    expect(within(row).getByText("lamsa")).toBeInTheDocument();
    expect(within(row).getByText("ماركة المتجر")).toBeInTheDocument();
    expect(within(row).getByText("نشطة")).toBeInTheDocument();
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(row.querySelector("img")).not.toBeNull();
    const inactive = screen
      .getByText("روز", { selector: "button" })
      .closest("tr") as HTMLElement;
    expect(within(inactive).getByText("غير نشطة")).toBeInTheDocument();
    expect(inactive.querySelector("img")).toBeNull();
  });

  it("shows the empty state", async () => {
    mockBackend(handlers({ "GET /admin/brands": () => ({ body: page([]) }) }));
    renderRoutes(routes, "/brands");
    expect(await screen.findByText("لا توجد ماركات")).toBeInTheDocument();
  });

  it("sends the URL's page, search and status to the backend", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(
      routes,
      "/brands?page=2&q=%D9%84%D9%85%D8%B3%D8%A9&status=inactive",
    );
    await screen.findByText("لمسة", { selector: "button" });
    const query = calls.find((c) => c.path === "/admin/brands")?.url
      .searchParams;
    expect(query?.get("page")).toBe("2");
    expect(query?.get("search")).toBe("لمسة");
    expect(query?.get("is_active")).toBe("false");
  });

  it("typing in the search box updates the URL and queries again", async () => {
    const calls = mockBackend(handlers());
    const { router } = renderRoutes(routes, "/brands?page=2");
    await screen.findByText("لمسة", { selector: "button" });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "روز" },
    });
    await waitFor(() => expect(router.state.location.search).toContain("q="));
    expect(
      new URLSearchParams(router.state.location.search).get("page"),
    ).toBeNull();
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.path === "/admin/brands" &&
            c.url.searchParams.get("search") === "روز",
        ),
      ).toBe(true),
    );
  });
});

describe("brand dialog", () => {
  it("opens empty, reports required fields, and sends nothing", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة ماركة" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText("أدخل اسم الماركة."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("creates a brand with a suggested slug, then closes with a success toast", async () => {
    const calls = mockBackend(
      handlers({
        "POST /admin/brands": () => ({
          status: 201,
          body: brand({ id: 9, name: "Nivea" }),
        }),
      }),
    );
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة ماركة" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/اسم الماركة/), {
      target: { value: "Nivea Men" },
    });
    expect(
      (within(dialog).getByLabelText("الرابط المختصر") as HTMLInputElement)
        .value,
    ).toBe("nivea-men");
    fireEvent.click(
      within(dialog).getByRole("switch", { name: /ماركة المتجر الخاصة/ }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تمت إضافة الماركة."),
    );
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
      name: "Nivea Men",
      slug: "nivea-men",
      is_own_brand: true,
      is_active: true,
      sort_order: 0,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("uploads a logo chosen while creating, right after the brand exists", async () => {
    const calls = mockBackend(
      handlers({
        "POST /admin/brands": () => ({ status: 201, body: brand({ id: 9 }) }),
        "PUT /admin/brands/9/logo": () => ({
          body: brand({ id: 9, logo: urls }),
        }),
      }),
    );
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: () => "blob:x",
        revokeObjectURL: () => {},
      }),
    );
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة ماركة" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/اسم الماركة/), {
      target: { value: "ماركة جديدة" },
    });
    fireEvent.change(within(dialog).getByTestId("image-input"), {
      target: {
        files: [
          new File([new Uint8Array(10)], "logo.png", { type: "image/png" }),
        ],
      },
    });
    expect(calls.some((c) => c.method === "PUT")).toBe(false); // nothing until the brand exists
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تمت إضافة الماركة."),
    );
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(
      expect.arrayContaining([
        "POST /admin/brands",
        "PUT /admin/brands/9/logo",
      ]),
    );
  });

  it("rejects a logo of the wrong type before any upload", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة ماركة" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByTestId("image-input"), {
      target: {
        files: [new File(["x"], "logo.svg", { type: "image/svg+xml" })],
      },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("edits a brand with PATCH, clearing nothing it did not change", async () => {
    const calls = mockBackend(
      handlers({
        "PATCH /admin/brands/2": () => ({
          body: brand({ id: 2, name: "روز الجديدة" }),
        }),
      }),
    );
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: /تعديل: روز/ }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByLabelText(
      /اسم الماركة/,
    ) as HTMLInputElement;
    expect(name.value).toBe("روز");
    expect(
      (within(dialog).getByLabelText("الرابط المختصر") as HTMLInputElement)
        .value,
    ).toBe("rose");
    fireEvent.change(name, { target: { value: "روز الجديدة" } });
    // editing never rewrites the slug from the name
    expect(
      (within(dialog).getByLabelText("الرابط المختصر") as HTMLInputElement)
        .value,
    ).toBe("rose");
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حفظ التغييرات."),
    );
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
      name: "روز الجديدة",
      slug: "rose",
      is_active: false,
      description: null,
    });
  });

  it("puts a taken slug on the slug field", async () => {
    mockBackend(
      handlers({
        "POST /admin/brands": () => ({
          status: 409,
          body: {
            error: {
              code: "SLUG_TAKEN",
              message: "هذا الرابط المختصر مستخدم. اختر رابطًا آخر.",
              details: { slug: "x" },
            },
          },
        }),
      }),
    );
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة ماركة" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/اسم الماركة/), {
      target: { value: "ماركة" },
    });
    fireEvent.change(within(dialog).getByLabelText("الرابط المختصر"), {
      target: { value: "lamsa" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText(
        "هذا الرابط المختصر مستخدم. اختر رابطًا آخر.",
      ),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("deleting a brand", () => {
  it("asks first and calls DELETE only after confirming", async () => {
    const calls = mockBackend(
      handlers({ "DELETE /admin/brands/2": () => ({ status: 204 }) }),
    );
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: /حذف: روز/ }));
    const dialog = await screen.findByRole("dialog");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حذف الماركة."),
    );
    expect(
      calls.some((c) => c.method === "DELETE" && c.path === "/admin/brands/2"),
    ).toBe(true);
  });

  it("cancelling never calls the API", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: /حذف: روز/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "إلغاء",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("shows the backend's message and the product count when the brand has products", async () => {
    mockBackend(
      handlers({
        "DELETE /admin/brands/1": () => ({
          status: 409,
          body: {
            error: {
              code: "BRAND_HAS_PRODUCTS",
              message: "لا يمكن حذف ماركة لها منتجات. أوقفها بدلًا من ذلك.",
              details: { products: 12 },
            },
          },
        }),
      }),
    );
    renderRoutes(routes, "/brands");
    fireEvent.click(await screen.findByRole("button", { name: /حذف: لمسة/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "حذف",
      }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const message = String(toast.error.mock.calls[0]?.[0]);
    expect(message).toContain("أوقفها بدلًا من ذلك");
    expect(message).toContain("منتجات: 12");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
