import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoriesPage } from "@/pages/categories";
import {
  CategoryCreatePage,
  CategoryEditPage,
} from "@/pages/categories/category-form-page";

import {
  mockBackend,
  renderRoutes,
  type Handlers,
} from "./support/backend-mock";
import {
  categoryDetail,
  categoryNode,
  categoryTree,
} from "./support/catalog-fixtures";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const listRoutes = [{ path: "/categories", element: <CategoriesPage /> }];

function listHandlers(extra: Handlers = {}): Handlers {
  return { "GET /admin/categories": () => ({ body: categoryTree }), ...extra };
}

describe("categories list (two-level tree)", () => {
  it("shows skeletons, then parents with their children indented beneath", async () => {
    mockBackend(listHandlers());
    renderRoutes(listRoutes, "/categories");
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);

    await screen.findByRole("link", { name: "العناية بالبشرة" });
    const rows = screen.getAllByRole("row").slice(1);
    expect(
      rows.map((r) => within(r).getAllByRole("cell")[0]?.textContent),
    ).toEqual(["العناية بالبشرة", "الكريمات", "الأمصال", "العطور"]);
    // children are indented, parents are not
    expect(
      within(rows[1] as HTMLElement)
        .getByText("الكريمات")
        .closest("div"),
    ).toHaveClass("ps-8");
    expect(
      within(rows[0] as HTMLElement)
        .getByText("العناية بالبشرة")
        .closest("div"),
    ).not.toHaveClass("ps-8");
  });

  it("shows slug, parent, status and product count per row", async () => {
    mockBackend(listHandlers());
    renderRoutes(listRoutes, "/categories");
    await screen.findByText("الكريمات");
    const child = screen.getByText("الكريمات").closest("tr") as HTMLElement;
    expect(within(child).getByText("creams")).toBeInTheDocument();
    expect(within(child).getByText("العناية بالبشرة")).toBeInTheDocument(); // parent column
    expect(within(child).getByText("نشط")).toBeInTheDocument();
    expect(within(child).getByText("4")).toBeInTheDocument();
    const inactive = screen.getByText("الأمصال").closest("tr") as HTMLElement;
    expect(within(inactive).getByText("غير نشط")).toBeInTheDocument();
    const parent = screen
      .getByText("العناية بالبشرة", { selector: "a" })
      .closest("tr") as HTMLElement;
    expect(within(parent).getByText("7")).toBeInTheDocument();
    expect(within(child).getByRole("link", { name: /تعديل/ })).toHaveAttribute(
      "href",
      "/categories/11/edit",
    );
    expect(screen.getByRole("link", { name: "إضافة قسم" })).toHaveAttribute(
      "href",
      "/categories/new",
    );
  });

  it("shows the empty state", async () => {
    mockBackend(
      listHandlers({ "GET /admin/categories": () => ({ body: [] }) }),
    );
    renderRoutes(listRoutes, "/categories");
    expect(await screen.findByText("لا توجد أقسام")).toBeInTheDocument();
  });

  it("asks for confirmation and calls DELETE only after it", async () => {
    const calls = mockBackend(
      listHandlers({ "DELETE /admin/categories/2": () => ({ status: 204 }) }),
    );
    renderRoutes(listRoutes, "/categories");
    await screen.findByText("العطور");
    fireEvent.click(screen.getByRole("button", { name: /حذف: العطور/ }));
    const dialog = await screen.findByRole("dialog");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حذف القسم."),
    );
    expect(
      calls.some(
        (c) => c.method === "DELETE" && c.path === "/admin/categories/2",
      ),
    ).toBe(true);
  });

  it("cancelling never calls the API", async () => {
    const calls = mockBackend(listHandlers());
    renderRoutes(listRoutes, "/categories");
    await screen.findByText("العطور");
    fireEvent.click(screen.getByRole("button", { name: /حذف: العطور/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "إلغاء",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("shows the backend's own message and the counts when a category is not empty", async () => {
    mockBackend(
      listHandlers({
        "DELETE /admin/categories/1": () => ({
          status: 409,
          body: {
            error: {
              code: "CATEGORY_NOT_EMPTY",
              message:
                "لا يمكن حذف قسم يحتوي على أقسام فرعية أو منتجات. أوقفه بدلًا من ذلك.",
              details: { children: 2, products: 7 },
            },
          },
        }),
      }),
    );
    renderRoutes(listRoutes, "/categories");
    await screen.findByRole("link", { name: "العناية بالبشرة" });
    fireEvent.click(
      screen.getByRole("button", { name: /حذف: العناية بالبشرة/ }),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "حذف",
      }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const message = String(toast.error.mock.calls[0]?.[0]);
    expect(message).toContain("أوقفه بدلًا من ذلك");
    expect(message).toContain("أقسام فرعية: 2");
    expect(message).toContain("منتجات: 7");
  });
});

const createRoutes = [
  { path: "/categories/new", element: <CategoryCreatePage /> },
  { path: "/categories/:id/edit", element: <p>صفحة التعديل</p> },
  { path: "/categories", element: <p>قائمة الأقسام</p> },
];

describe("create category", () => {
  const handlers = (extra: Handlers = {}) =>
    listHandlers({
      "POST /admin/categories": () => ({
        status: 201,
        body: categoryDetail({ id: 55 }),
      }),
      ...extra,
    });

  it("reports the required name and sends nothing", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(createRoutes, "/categories/new");
    fireEvent.click(await screen.findByRole("button", { name: "حفظ" }));
    expect(await screen.findByText("أدخل اسم القسم.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("suggests a slug from a latin name until the slug is edited by hand", async () => {
    mockBackend(handlers());
    renderRoutes(createRoutes, "/categories/new");
    const name = await screen.findByLabelText(/اسم القسم/);
    const slug = screen.getByLabelText("الرابط المختصر") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Face Cream" } });
    expect(slug.value).toBe("face-cream");
    fireEvent.change(slug, { target: { value: "my-slug" } });
    fireEvent.change(name, { target: { value: "Face Cream 2" } });
    expect(slug.value).toBe("my-slug");
  });

  it("leaves the slug to the backend for an Arabic name and says so", async () => {
    mockBackend(handlers());
    renderRoutes(createRoutes, "/categories/new");
    fireEvent.change(await screen.findByLabelText(/اسم القسم/), {
      target: { value: "كريمات" },
    });
    expect(
      (screen.getByLabelText("الرابط المختصر") as HTMLInputElement).value,
    ).toBe("");
    expect(
      screen.getByText(/يُولَّد الرابط تلقائياً من الاسم العربي/),
    ).toBeInTheDocument();
  });

  it("rejects an invalid slug before sending", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(createRoutes, "/categories/new");
    fireEvent.change(await screen.findByLabelText(/اسم القسم/), {
      target: { value: "قسم" },
    });
    fireEvent.change(screen.getByLabelText("الرابط المختصر"), {
      target: { value: "Bad Slug" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(
      await screen.findByText(/أحرف لاتينية صغيرة وأرقام وشرطات فقط/),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("creates the category, then opens its edit page to add attributes", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(createRoutes, "/categories/new");
    fireEvent.change(await screen.findByLabelText(/اسم القسم/), {
      target: { value: "مكياج" },
    });
    fireEvent.change(screen.getByLabelText("ترتيب العرض"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const post = calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({
      name: "مكياج",
      parent_id: null,
      sort_order: 3,
      is_active: true,
    });
    expect((post?.body as { slug?: string } | undefined)?.slug).toBeUndefined();
    expect(await screen.findByText("صفحة التعديل")).toBeInTheDocument();
  });

  it("puts a taken slug on the slug field", async () => {
    mockBackend(
      handlers({
        "POST /admin/categories": () => ({
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
    renderRoutes(createRoutes, "/categories/new");
    fireEvent.change(await screen.findByLabelText(/اسم القسم/), {
      target: { value: "قسم" },
    });
    fireEvent.change(screen.getByLabelText("الرابط المختصر"), {
      target: { value: "taken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(
      await screen.findByText("هذا الرابط المختصر مستخدم. اختر رابطًا آخر."),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

const editRoutes = [
  { path: "/categories/:id/edit", element: <CategoryEditPage /> },
  { path: "/categories", element: <p>قائمة الأقسام</p> },
];

function editHandlers(
  detail = categoryDetail(),
  extra: Handlers = {},
): Handlers {
  return {
    "GET /admin/categories": () => ({ body: categoryTree }),
    "GET /admin/categories/11": () => ({ body: detail }),
    ...extra,
  };
}

describe("edit category: basic fields", () => {
  it("fills the form from the backend and saves with PATCH, then returns to the list", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "PATCH /admin/categories/11": () => ({ body: categoryDetail() }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    const name = (await screen.findByLabelText(
      /اسم القسم/,
    )) as HTMLInputElement;
    expect(name.value).toBe("الكريمات");
    expect(
      (screen.getByLabelText("الرابط المختصر") as HTMLInputElement).value,
    ).toBe("creams");
    fireEvent.change(name, { target: { value: "الكريمات المرطبة" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حفظ التغييرات."),
    );
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toMatchObject({
      name: "الكريمات المرطبة",
      slug: "creams",
      parent_id: 1,
    });
    expect(await screen.findByText("قائمة الأقسام")).toBeInTheDocument();
  });

  it("offers only top-level categories as parent, never itself", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail({ id: 11 } as never)),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    const trigger = await screen.findByRole("combobox", { name: /القسم الأب/ });
    await waitFor(() =>
      expect(calls.some((c) => c.path === "/admin/categories")).toBe(true),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    fireEvent.pointerDown(trigger, {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    const options = (await screen.findAllByRole("option")).map(
      (o) => o.textContent,
    );
    expect(options).toEqual([
      "بدون (قسم رئيسي)",
      "العناية بالبشرة",
      "العطور (غير نشط)",
    ]);
  });

  it("locks the parent for a category that has children", async () => {
    mockBackend({
      "GET /admin/categories": () => ({ body: categoryTree }),
      "GET /admin/categories/1": () => ({
        body: categoryDetail({
          id: 1,
          name: "العناية بالبشرة",
          slug: "skin-care",
          parent_id: null,
          children: categoryTree[0]?.children,
          effective_attributes: [],
          own_attributes: [],
          own_variant_options: [],
          effective_variant_options: [],
        } as never),
      }),
    });
    renderRoutes(editRoutes, "/categories/1/edit");
    const trigger = await screen.findByRole("combobox", { name: /القسم الأب/ });
    expect(trigger).toBeDisabled();
    expect(
      screen.getByText(/لا يمكن جعل قسم له أقسام فرعية قسماً فرعياً/),
    ).toBeInTheDocument();
  });

  it("shows not-found for an unknown category", async () => {
    mockBackend({
      "GET /admin/categories/11": () => ({
        status: 404,
        body: {
          error: {
            code: "CATEGORY_NOT_FOUND",
            message: "القسم غير موجود.",
            details: null,
          },
        },
      }),
    });
    renderRoutes(editRoutes, "/categories/11/edit");
    expect(await screen.findByText("القسم غير موجود.")).toBeInTheDocument();
  });
});

describe("edit category: attributes", () => {
  it("lists own attributes with their details and inherited ones read-only with a badge", async () => {
    mockBackend(editHandlers());
    renderRoutes(editRoutes, "/categories/11/edit");
    await screen.findByText("الحجم");
    const volume = screen.getByText("الحجم").closest("li") as HTMLElement;
    expect(within(volume).getByText("مطلوبة")).toBeInTheDocument();
    expect(within(volume).getByText("volume")).toBeInTheDocument();
    expect(
      within(volume).getByRole("button", { name: /تعديل: الحجم/ }),
    ).toBeInTheDocument();
    const skin = screen.getByText("نوع البشرة").closest("li") as HTMLElement;
    expect(within(skin).getByText("جافة، دهنية")).toBeInTheDocument();

    const inherited = screen
      .getByText("ملاحظة الماركة")
      .closest("li") as HTMLElement;
    expect(
      within(inherited).getByText("موروث من القسم الأب"),
    ).toBeInTheDocument();
    expect(within(inherited).queryByRole("button")).toBeNull();
    expect(
      within(inherited).getByRole("link", {
        name: /تُعدَّل من صفحة القسم الأب/,
      }),
    ).toHaveAttribute("href", "/categories/1/edit");
  });

  async function openAttributeDialog() {
    fireEvent.click(await screen.findByRole("button", { name: "إضافة خاصية" }));
    return await screen.findByRole("dialog");
  }

  it("validates the add form (key and label) before calling the API", async () => {
    const calls = mockBackend(editHandlers());
    renderRoutes(editRoutes, "/categories/11/edit");
    const dialog = await openAttributeDialog();
    fireEvent.change(within(dialog).getByLabelText(/المفتاح/), {
      target: { value: "Bad Key" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText(/المفتاح: حرف لاتيني صغير/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("أدخل الاسم.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("adds a select attribute with its options list", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "POST /admin/categories/11/attributes": () => ({
          status: 201,
          body: {},
        }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    const dialog = await openAttributeDialog();
    fireEvent.change(within(dialog).getByLabelText(/المفتاح/), {
      target: { value: "finish" },
    });
    fireEvent.change(within(dialog).getByLabelText(/الاسم \(يظهر للمستخدم\)/), {
      target: { value: "اللمعة" },
    });
    // choose type "اختيار واحد": the options editor appears
    fireEvent.pointerDown(
      within(dialog).getByRole("combobox", { name: "النوع" }),
      {
        button: 0,
        ctrlKey: false,
        pointerType: "mouse",
      },
    );
    fireEvent.click(await screen.findByRole("option", { name: "اختيار واحد" }));
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "إضافة قيمة" }),
    );
    fireEvent.change(within(dialog).getByLabelText("قيمة جديدة 1"), {
      target: { value: "مطفي" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "إضافة قيمة" }));
    fireEvent.change(within(dialog).getByLabelText("قيمة جديدة 2"), {
      target: { value: "لامع" },
    });
    fireEvent.click(
      within(dialog).getByRole("switch", { name: /تُستخدم للفلترة/ }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تمت إضافة الخاصية."),
    );
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      key: "finish",
      label: "اللمعة",
      type: "select",
      options: ["مطفي", "لامع"],
      is_required: false,
      is_filterable: true,
      sort_order: 0,
    });
  });

  it("requires options for a select attribute", async () => {
    const calls = mockBackend(editHandlers());
    renderRoutes(editRoutes, "/categories/11/edit");
    const dialog = await openAttributeDialog();
    fireEvent.change(within(dialog).getByLabelText(/المفتاح/), {
      target: { value: "finish" },
    });
    fireEvent.change(within(dialog).getByLabelText(/الاسم \(يظهر للمستخدم\)/), {
      target: { value: "اللمعة" },
    });
    fireEvent.pointerDown(
      within(dialog).getByRole("combobox", { name: "النوع" }),
      {
        button: 0,
        ctrlKey: false,
        pointerType: "mouse",
      },
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "اختيار متعدد" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText("أضف قيمة واحدة على الأقل."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("maps a taken key to the key field", async () => {
    mockBackend(
      editHandlers(categoryDetail(), {
        "POST /admin/categories/11/attributes": () => ({
          status: 409,
          body: {
            error: {
              code: "ATTRIBUTE_KEY_TAKEN",
              message: "هذا المفتاح مستخدم في هذا القسم.",
              details: { key: "volume" },
            },
          },
        }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    const dialog = await openAttributeDialog();
    fireEvent.change(within(dialog).getByLabelText(/المفتاح/), {
      target: { value: "volume" },
    });
    fireEvent.change(within(dialog).getByLabelText(/الاسم \(يظهر للمستخدم\)/), {
      target: { value: "الحجم" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText("هذا المفتاح مستخدم في هذا القسم."),
    ).toBeInTheDocument();
  });

  it("edits an attribute: key is locked and only changes are sent through PATCH", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "PATCH /admin/categories/11/attributes/1": () => ({ body: {} }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    fireEvent.click(
      await screen.findByRole("button", { name: /تعديل: الحجم/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/المفتاح/)).toBeDisabled();
    expect(
      (
        within(dialog).getByLabelText(
          /الاسم \(يظهر للمستخدم\)/,
        ) as HTMLInputElement
      ).value,
    ).toBe("الحجم");
    fireEvent.change(within(dialog).getByLabelText(/الاسم \(يظهر للمستخدم\)/), {
      target: { value: "حجم العبوة" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حفظ الخاصية."),
    );
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      label: "حجم العبوة",
      type: "number",
      options: null,
      unit: "ml",
      is_required: true,
      is_filterable: false,
      sort_order: 0,
    });
  });

  it("shows why a changed type is refused when products use the attribute", async () => {
    mockBackend(
      editHandlers(categoryDetail(), {
        "PATCH /admin/categories/11/attributes/1": () => ({
          status: 409,
          body: {
            error: {
              code: "ATTRIBUTE_IN_USE",
              message: "هذه الخاصية مستخدمة في منتجات حاليًا.",
              details: { key: "volume", products_count: 4 },
            },
          },
        }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    fireEvent.click(
      await screen.findByRole("button", { name: /تعديل: الحجم/ }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText("هذه الخاصية مستخدمة في منتجات حاليًا."),
    ).toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("volume (4)"));
  });

  it("deletes an unused attribute after one confirmation", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "DELETE /admin/categories/11/attributes/2": () => ({ status: 204 }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    fireEvent.click(
      await screen.findByRole("button", { name: /حذف: نوع البشرة/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم الحذف."),
    );
    const del = calls.find((c) => c.method === "DELETE");
    expect(del?.url.searchParams.get("force")).toBe("false");
  });

  it("needs a second, explicit confirmation to force-delete an attribute that products use", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "DELETE /admin/categories/11/attributes/1": (request) =>
          new URL(request.url).searchParams.get("force") === "true"
            ? { status: 204 }
            : {
                status: 409,
                body: {
                  error: {
                    code: "ATTRIBUTE_IN_USE",
                    message: "هذه الخاصية مستخدمة في منتجات حاليًا.",
                    details: { key: "volume", products_count: 3 },
                  },
                },
              },
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    fireEvent.click(await screen.findByRole("button", { name: /حذف: الحجم/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "حذف",
      }),
    );

    // refused: nothing was forced, and a second dialog explains the consequence
    const force = await screen.findByText(/ستُحذف قيمة هذه الخاصية من 3 منتج/);
    expect(force).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "حذف وإزالتها من المنتجات" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم الحذف."),
    );
    const deletes = calls.filter((c) => c.method === "DELETE");
    expect(deletes).toHaveLength(2);
    expect(deletes[1]?.url.searchParams.get("force")).toBe("true");
  });

  it("declining the force confirmation deletes nothing", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "DELETE /admin/categories/11/attributes/1": () => ({
          status: 409,
          body: {
            error: {
              code: "ATTRIBUTE_IN_USE",
              message: "مستخدمة",
              details: { key: "volume", products_count: 3 },
            },
          },
        }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    fireEvent.click(await screen.findByRole("button", { name: /حذف: الحجم/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "حذف",
      }),
    );
    await screen.findByText(/ستُحذف قيمة هذه الخاصية/);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "إلغاء" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
  });
});

describe("edit category: variant options", () => {
  it("lists variant options separately from attributes", async () => {
    mockBackend(editHandlers());
    renderRoutes(editRoutes, "/categories/11/edit");
    await screen.findByText("اللون");
    const option = screen.getByText("اللون").closest("li") as HTMLElement;
    expect(within(option).getByText("color")).toBeInTheDocument();
    expect(within(option).getByText(/اسم اللون مع قيمته/)).toBeInTheDocument();
  });

  it("adds a color option without any list of values", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "POST /admin/categories/11/variant-options": () => ({
          status: 201,
          body: {},
        }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة خيار" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/المفتاح/), {
      target: { value: "shade" },
    });
    fireEvent.change(within(dialog).getByLabelText(/الاسم \(يظهر للمستخدم\)/), {
      target: { value: "الدرجة" },
    });
    expect(
      within(dialog).getByText(/خيار اللون لا يحتاج قائمة قيم/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تمت إضافة الخيار."),
    );
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      key: "shade",
      label: "الدرجة",
      type: "color",
      sort_order: 0,
    });
  });

  it("shows the backend's refusal, with the variant count, when an option is in use", async () => {
    mockBackend(
      editHandlers(categoryDetail(), {
        "DELETE /admin/categories/11/variant-options/1": () => ({
          status: 409,
          body: {
            error: {
              code: "VARIANT_OPTION_IN_USE",
              message: "هذا الخيار مستخدم في منتجات حاليًا.",
              details: { key: "color", variants_count: 6 },
            },
          },
        }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    fireEvent.click(await screen.findByRole("button", { name: /حذف: اللون/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "حذف",
      }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const message = String(toast.error.mock.calls[0]?.[0]);
    expect(message).toContain("هذا الخيار مستخدم في منتجات حاليًا.");
    expect(message).toContain("color (6)");
  });

  it("an inherited option is read-only", async () => {
    mockBackend(
      editHandlers(
        categoryDetail({
          own_variant_options: [],
          effective_variant_options: [
            {
              id: 7,
              category_id: 1,
              key: "size",
              label: "المقاس",
              type: "select",
              options: ["S", "M"],
              sort_order: 0,
              inherited: true,
            },
          ],
        } as never),
      ),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    const row = (await screen.findByText("المقاس")).closest(
      "li",
    ) as HTMLElement;
    expect(within(row).getByText("موروث من القسم الأب")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(within(row).getByText("S، M")).toBeInTheDocument();
  });
});

describe("category image", () => {
  it("uploads a picked image to the category's image endpoint", async () => {
    const calls = mockBackend(
      editHandlers(categoryDetail(), {
        "PUT /admin/categories/11/image": () => ({ body: categoryDetail() }),
      }),
    );
    renderRoutes(editRoutes, "/categories/11/edit");
    const input = (
      await screen.findAllByTestId("image-input")
    )[0] as HTMLInputElement;
    const file = new File([new Uint8Array(10)], "cover.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم تحديث الصورة."),
    );
    expect(
      calls.some(
        (c) => c.method === "PUT" && c.path === "/admin/categories/11/image",
      ),
    ).toBe(true);
  });

  it("rejects a wrong file type without calling the API", async () => {
    const calls = mockBackend(editHandlers());
    renderRoutes(editRoutes, "/categories/11/edit");
    const input = (
      await screen.findAllByTestId("image-input")
    )[0] as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });
});

void categoryNode;
