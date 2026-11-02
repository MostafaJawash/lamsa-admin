import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductCreatePage } from "@/pages/products/product-form-page";

import {
  brandsReply,
  categoriesReply,
  categoryDetail,
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

const created = {
  id: 77,
  type: "simple",
  currency: "SYP",
  name: "كريم الورد",
  images: [],
  variants: [],
};

function handlers(extra: Handlers = {}): Handlers {
  return {
    "GET /admin/categories": () => ({ body: categoriesReply }),
    "GET /admin/categories/3": () => ({ body: categoryDetail }),
    "GET /admin/brands": () => ({ body: brandsReply }),
    ...extra,
  };
}

const routes = [
  { path: "/products/new", element: <ProductCreatePage /> },
  { path: "/products", element: <p>قائمة المنتجات</p> },
];

async function chooseCategory() {
  const trigger = await screen.findByRole("combobox", { name: /القسم/ });
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  const option = await screen.findByRole("option", { name: "العناية بالبشرة" });
  fireEvent.click(option);
}

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("create product form", () => {
  it("shows validation errors for the missing required fields and calls nothing", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/products/new");
    fireEvent.click(await screen.findByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("أدخل اسم المنتج.")).toBeInTheDocument();
    expect(screen.getByText("اختر القسم.")).toBeInTheDocument();
    expect(screen.getByText("أدخل السعر.")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("rejects a SYP price with decimals", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/products/new");
    await screen.findByRole("button", { name: "حفظ" });
    fill(/^السعر/, "10.5");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(
      await screen.findByText("أدخل مبلغاً صحيحاً بالليرة بدون كسور."),
    ).toBeInTheDocument();
  });

  it("submits a valid simple product, then shows the success toast and returns to the list", async () => {
    const calls = mockBackend(
      handlers({
        "POST /admin/products": () => ({ status: 201, body: created }),
      }),
    );
    renderRoutes(routes, "/products/new");
    await screen.findByRole("button", { name: "حفظ" });
    fill(/اسم المنتج/, "كريم الورد");
    await chooseCategory();
    fill(/^السعر/, "15000");
    fill(/المخزون/, "5");
    const submit = screen.getByRole("button", { name: "حفظ" });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تمت إضافة المنتج."),
    );
    const post = calls.find((call) => call.method === "POST");
    expect(post?.path).toBe("/admin/products");
    expect(post?.body).toMatchObject({
      type: "simple",
      currency: "SYP",
      name: "كريم الورد",
      category_id: 3,
      price: "15000",
      stock: 5,
      is_active: false,
    });
    expect(await screen.findByText("قائمة المنتجات")).toBeInTheDocument();
  });

  it("puts a backend 422 on the field it names instead of only a toast", async () => {
    mockBackend(
      handlers({
        "POST /admin/products": () => ({
          status: 422,
          body: {
            error: {
              code: "VALIDATION_ERROR",
              message: "x",
              details: [{ field: "price", message: "must be between 0 and 1" }],
            },
          },
        }),
      }),
    );
    renderRoutes(routes, "/products/new");
    await screen.findByRole("button", { name: "حفظ" });
    fill(/اسم المنتج/, "كريم");
    await chooseCategory();
    fill(/^السعر/, "15000");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(
      await screen.findByText("must be between 0 and 1"),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a duplicate SKU on the SKU field", async () => {
    mockBackend(
      handlers({
        "POST /admin/products": () => ({
          status: 409,
          body: {
            error: {
              code: "SKU_TAKEN",
              message: "رمز المنتج (SKU) مستخدم لمنتج آخر.",
              details: null,
            },
          },
        }),
      }),
    );
    renderRoutes(routes, "/products/new");
    await screen.findByRole("button", { name: "حفظ" });
    fill(/اسم المنتج/, "كريم");
    await chooseCategory();
    fill(/^السعر/, "15000");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(
      await screen.findByText("رمز المنتج (SKU) مستخدم لمنتج آخر."),
    ).toBeInTheDocument();
  });
});

describe("catalog changes reach the product form", () => {
  it("marks inactive categories and brands in the selects without hiding them", async () => {
    mockBackend({
      "GET /admin/categories": () => ({
        body: [
          {
            id: 3,
            name: "العناية بالبشرة",
            slug: "skin",
            parent_id: null,
            is_active: true,
            children: [
              {
                id: 4,
                name: "الكريمات",
                slug: "creams",
                parent_id: 3,
                is_active: false,
                children: [],
              },
            ],
          },
          {
            id: 5,
            name: "العطور",
            slug: "perfumes",
            parent_id: null,
            is_active: false,
            children: [],
          },
        ],
      }),
      "GET /admin/brands": () => ({
        body: {
          items: [
            { id: 2, name: "لمسة", slug: "lamsa", is_active: true },
            { id: 3, name: "روز", slug: "rose", is_active: false },
          ],
          page: 1,
          page_size: 100,
          total: 2,
        },
      }),
    });
    renderRoutes(routes, "/products/new");
    const category = await screen.findByRole("combobox", { name: /القسم/ });
    await new Promise((resolve) => setTimeout(resolve, 100));
    fireEvent.pointerDown(category, {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual([
      "العناية بالبشرة",
      "العناية بالبشرة ‹ الكريمات (غير نشط)",
      "العطور (غير نشط)",
    ]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    fireEvent.pointerDown(screen.getByRole("combobox", { name: /الماركة/ }), {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["بدون ماركة", "لمسة", "روز (غير نشط)"]);
  });
});
