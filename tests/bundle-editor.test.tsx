import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProductCreatePage,
  ProductEditPage,
} from "@/pages/products/product-form-page";

import {
  brandsReply,
  categoriesReply,
  categoryDetail,
  listItem,
  mockBackend,
  renderRoutes,
  urls,
  type Handlers,
} from "./support/backend-mock";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const component = (id: number, name: string, price: string, over = {}) => ({
  id,
  type: "simple",
  currency: "SYP",
  name,
  slug: `p-${id}`,
  price_from: price,
  is_active: true,
  images: [{ id: 1, urls, sort_order: 0 }],
  variants: [],
  bundle_items: [],
  ...over,
});

const bundle = {
  id: 10,
  type: "bundle",
  currency: "SYP",
  name: "علبة الهدايا",
  slug: "gift-box",
  description: null,
  category: { id: 3, name: "العناية بالبشرة", slug: "skin" },
  brand: null,
  sku: null,
  price: "20000.00",
  sale_price: null,
  stock: null,
  bundle_stock: 4,
  attributes: {},
  is_new: false,
  is_active: false,
  images: [],
  variants: [],
  bundle_items: [
    {
      id: 1,
      product_id: 1,
      product_name: "كريم",
      product_slug: "p-1",
      variant_id: null,
      variant_label: null,
      quantity: 2,
      component_stock: 9,
      component_active: true,
    },
    {
      id: 2,
      product_id: 2,
      product_name: "عطر",
      product_slug: "p-2",
      variant_id: null,
      variant_label: null,
      quantity: 1,
      component_stock: 9,
      component_active: true,
    },
  ],
};

const listReply = (items: unknown[]) => ({
  body: { items, page: 1, page_size: 20, total: items.length },
});

function handlers(extra: Handlers = {}): Handlers {
  return {
    "GET /admin/categories": () => ({ body: categoriesReply }),
    "GET /admin/categories/3": () => ({ body: categoryDetail }),
    "GET /admin/brands": () => ({ body: brandsReply }),
    "GET /admin/products/10": () => ({ body: bundle }),
    "GET /admin/products/1": () => ({ body: component(1, "كريم", "8000.00") }),
    "GET /admin/products/2": () => ({ body: component(2, "عطر", "15000.00") }),
    "GET /admin/products": () =>
      listReply([
        listItem({ id: 1, name: "كريم", slug: "p-1" }),
        listItem({ id: 2, name: "عطر", slug: "p-2" }),
        listItem({ id: 3, name: "دولار", slug: "p-3", currency: "USD" }),
        listItem({ id: 4, name: "علبة أخرى", slug: "p-4", type: "bundle" }),
      ]),
    ...extra,
  };
}

const routes = [
  { path: "/products/new", element: <ProductCreatePage /> },
  { path: "/products/:id/edit", element: <ProductEditPage /> },
  { path: "/products", element: <p>قائمة المنتجات</p> },
];

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openSelect(name: RegExp) {
  fireEvent.pointerDown(await screen.findByRole("combobox", { name }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
}

async function chooseType(label: string) {
  await openSelect(/نوع المنتج/);
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

async function pickComponent(name: string) {
  const list = await screen.findByRole("listbox", {
    name: "ابحث عن منتج لإضافته إلى العلبة",
  });
  fireEvent.click(
    await within(list).findByRole("button", { name: new RegExp(name) }),
  );
}

const section = () => screen.queryByRole("heading", { name: "محتويات العلبة" });

describe("bundle contents section", () => {
  it("renders only for type=bundle (also on create)", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/products/new");
    await screen.findByRole("button", { name: "حفظ" });
    expect(section()).toBeNull();
    await chooseType("علبة هدايا");
    expect(section()).toBeInTheDocument();
    expect(
      screen.getByText("لم تتم إضافة منتجات لهذه العلبة بعد"),
    ).toBeVisible();
    await chooseType("بسيط");
    expect(section()).toBeNull();
  });

  it("is not shown when editing a simple product", async () => {
    mockBackend(
      handlers({
        "GET /admin/products/9": () => ({
          body: {
            ...bundle,
            id: 9,
            type: "simple",
            stock: 3,
            bundle_items: [],
          },
        }),
      }),
    );
    renderRoutes(routes, "/products/9/edit");
    await screen.findByRole("button", { name: "حفظ" });
    expect(section()).toBeNull();
  });

  it("pre-populates an existing bundle with its items, total and derived stock", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/products/10/edit");
    expect(await screen.findByText("كريم")).toBeInTheDocument();
    expect(screen.getByText("عطر")).toBeInTheDocument();
    expect(screen.getByLabelText("الكمية: كريم")).toHaveValue("2");
    expect(screen.getByLabelText("الكمية: عطر")).toHaveValue("1");
    // 8,000 × 2 + 15,000, against the bundle price of 20,000
    await waitFor(() =>
      expect(screen.getByTestId("bundle-total")).toHaveTextContent(
        "31,000 ل.س",
      ),
    );
    expect(screen.getByTestId("bundle-saving")).toHaveTextContent("11,000 ل.س");
    expect(screen.getByText(/المتوفر من العلبة/)).toHaveTextContent("4");
    // an existing bundle's currency is locked until its contents are emptied
    expect(screen.getByRole("combobox", { name: /العملة/ })).toBeDisabled();
  });

  it("adds a product, blocks a duplicate, and removes lines", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/products/10/edit");
    await screen.findByText("كريم");
    // only same-currency products, never bundles, are offered
    const list = await screen.findByRole("listbox", {
      name: "ابحث عن منتج لإضافته إلى العلبة",
    });
    await within(list).findByRole("button", { name: /كريم/ });
    expect(within(list).queryByText("دولار")).toBeNull();
    expect(within(list).queryByText("علبة أخرى")).toBeNull();

    // already in the bundle: warned, not added twice
    fireEvent.click(within(list).getByRole("button", { name: /كريم/ }));
    expect(
      await screen.findByText(
        "هذا المنتج (بهذا الخيار) مضاف إلى العلبة مسبقاً.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/الكمية/)).toHaveLength(2);

    // remove both lines: the empty message returns and the picker stays usable
    fireEvent.click(
      screen.getByRole("button", { name: "إزالة من العلبة: كريم" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "إزالة من العلبة: عطر" }),
    );
    expect(
      screen.getByText("لم تتم إضافة منتجات لهذه العلبة بعد"),
    ).toBeVisible();
    await pickComponent("كريم");
    expect(await screen.findByLabelText("الكمية: كريم")).toHaveValue("1");
  });

  it("rejects a quantity outside 1-99 and calls nothing", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/products/10/edit");
    fireEvent.change(await screen.findByLabelText("الكمية: كريم"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(await screen.findByText("الكمية من 1 إلى 99.")).toBeInTheDocument();
    expect(
      calls.some((call) => call.method === "PATCH" || call.method === "PUT"),
    ).toBe(false);
  });

  it("saves with PATCH then a full-replace PUT of the whole list", async () => {
    const calls = mockBackend(
      handlers({
        "PATCH /admin/products/10": () => ({ body: bundle }),
        "PUT /admin/products/10/bundle-items": () => ({ body: bundle }),
      }),
    );
    renderRoutes(routes, "/products/10/edit");
    fireEvent.change(await screen.findByLabelText("الكمية: كريم"), {
      target: { value: "3" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "إزالة من العلبة: عطر" }),
    );
    await pickComponent("عطر");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const writes = calls.filter((call) => call.method !== "GET");
    expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
      "PATCH /admin/products/10",
      "PUT /admin/products/10/bundle-items",
    ]);
    expect(writes[1]?.body).toEqual({
      items: [
        { product_id: 1, variant_id: null, quantity: 3 },
        { product_id: 2, variant_id: null, quantity: 1 },
      ],
    });
  });

  it("does not call the bundle endpoint when the contents are unchanged", async () => {
    const calls = mockBackend(
      handlers({ "PATCH /admin/products/10": () => ({ body: bundle }) }),
    );
    renderRoutes(routes, "/products/10/edit");
    await screen.findByLabelText("الكمية: كريم");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("can empty a bundle (an empty list is a valid PUT)", async () => {
    const calls = mockBackend(
      handlers({
        "PATCH /admin/products/10": () => ({ body: bundle }),
        "PUT /admin/products/10/bundle-items": () => ({ body: bundle }),
      }),
    );
    renderRoutes(routes, "/products/10/edit");
    await screen.findByLabelText("الكمية: كريم");
    fireEvent.click(
      screen.getByRole("button", { name: "إزالة من العلبة: كريم" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "إزالة من العلبة: عطر" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      items: [],
    });
  });

  it("puts the backend's per-line error on the line that caused it", async () => {
    mockBackend(
      handlers({
        "PATCH /admin/products/10": () => ({ body: bundle }),
        "PUT /admin/products/10/bundle-items": () => ({
          status: 422,
          body: {
            error: {
              code: "BUNDLE_CURRENCY_MISMATCH",
              message: "x",
              details: {
                index: 1,
                bundle_currency: "SYP",
                component_currency: "USD",
              },
            },
          },
        }),
      }),
    );
    renderRoutes(routes, "/products/10/edit");
    fireEvent.change(await screen.findByLabelText("الكمية: عطر"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    const row = (await screen.findByLabelText("الكمية: عطر")).closest("li");
    expect(
      await within(row as HTMLElement).findByText(
        "هذا المنتج غير متاح بنفس عملة العلبة.",
      ),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("activates only after the new contents are saved", async () => {
    const calls = mockBackend(
      handlers({
        "PATCH /admin/products/10": () => ({ body: bundle }),
        "PUT /admin/products/10/bundle-items": () => ({ body: bundle }),
      }),
    );
    renderRoutes(routes, "/products/10/edit");
    fireEvent.change(await screen.findByLabelText("الكمية: كريم"), {
      target: { value: "5" },
    });
    fireEvent.click(document.getElementById("is_active") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const writes = calls.filter((call) => call.method !== "GET");
    expect(writes.map((call) => call.method)).toEqual([
      "PATCH",
      "PUT",
      "PATCH",
    ]);
    expect(writes[0]?.body).not.toHaveProperty("is_active");
    expect(writes[2]?.body).toEqual({ is_active: true });
  });

  it("warns on a component whose currency differs from the bundle's", async () => {
    mockBackend(
      handlers({
        "GET /admin/products/2": () => ({
          body: component(2, "عطر", "5.00", { currency: "USD" }),
        }),
      }),
    );
    renderRoutes(routes, "/products/10/edit");
    expect(
      await screen.findByText("هذا المنتج غير متاح بنفس عملة العلبة."),
    ).toBeInTheDocument();
    expect(screen.getByText(/المجموع لا يشمل/)).toBeInTheDocument();
  });

  it("shows an inactive badge for an inactive component instead of blocking it", async () => {
    mockBackend(
      handlers({
        "GET /admin/products/1": () => ({
          body: component(1, "كريم", "8000.00", { is_active: false }),
        }),
      }),
    );
    renderRoutes(routes, "/products/10/edit");
    expect(await screen.findByText("غير نشط")).toBeInTheDocument();
  });

  it("offers a variant choice for a variable component", async () => {
    mockBackend(
      handlers({
        "GET /admin/products": () =>
          listReply([
            listItem({ id: 5, name: "حقيبة", slug: "bag", type: "variable" }),
          ]),
        "GET /admin/products/5": () => ({
          body: component(5, "حقيبة", "3000.00", {
            type: "variable",
            variants: [
              {
                id: 51,
                sku: "B-R",
                options: { color: "أحمر", color_hex: "#FF0000" },
                current_price: "3000.00",
                is_active: true,
              },
            ],
          }),
        }),
      }),
    );
    renderRoutes(routes, "/products/10/edit");
    await screen.findByText("كريم");
    await pickComponent("حقيبة");
    await openSelect(/اختر الخيار/);
    fireEvent.click(await screen.findByRole("option", { name: "أحمر" }));
    fireEvent.click(screen.getByRole("button", { name: "إضافة إلى العلبة" }));
    expect(await screen.findByLabelText("الكمية: حقيبة")).toHaveValue("1");
    expect(screen.getAllByText("أحمر").length).toBeGreaterThan(0);
  });
});

describe("creating a bundle", () => {
  it("sends the contents inline in POST /admin/products", async () => {
    const calls = mockBackend(
      handlers({
        "POST /admin/products": () => ({
          status: 201,
          body: {
            id: 77,
            type: "bundle",
            currency: "SYP",
            images: [],
            variants: [],
          },
        }),
      }),
    );
    renderRoutes(routes, "/products/new");
    await chooseType("علبة هدايا");
    fireEvent.change(screen.getByLabelText(/اسم المنتج/), {
      target: { value: "علبة جديدة" },
    });
    await openSelect(/القسم/);
    fireEvent.click(
      await screen.findByRole("option", { name: "العناية بالبشرة" }),
    );
    fireEvent.change(screen.getByLabelText(/^السعر/), {
      target: { value: "20000" },
    });
    await pickComponent("كريم");
    fireEvent.change(await screen.findByLabelText("الكمية: كريم"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toMatchObject({
      type: "bundle",
      price: "20000",
      bundle_items: [{ product_id: 1, variant_id: null, quantity: 2 }],
    });
    expect(post?.body).not.toHaveProperty("stock");
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });
});
