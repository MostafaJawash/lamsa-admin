import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Banner } from "@/features/banners";
import { BannersPage } from "@/pages/banners";

import {
  listItem,
  mockBackend,
  renderRoutes,
  urls,
  type Handlers,
} from "./support/backend-mock";
import { brand, categoryTree } from "./support/catalog-fixtures";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

function banner(over: Partial<Banner> & { id: number }): Banner {
  return {
    title: `بانر ${over.id}`,
    subtitle: null,
    image: urls,
    link: { type: "none", value: null },
    sort_order: over.id,
    is_active: true,
    starts_at: null,
    ends_at: null,
    state: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as Banner;
}

const rows = [
  banner({
    id: 1,
    title: "عرض الورد",
    subtitle: "خصم 20%",
    link: { type: "product", value: "rose-cream" },
  }),
  banner({
    id: 2,
    title: "قسم البشرة",
    link: { type: "category", value: "skin-care" },
    state: "scheduled",
    starts_at: "2026-12-01T07:00:00",
    ends_at: "2026-12-10T07:00:00",
  }),
  banner({
    id: 3,
    title: "ماركة لمسة",
    link: { type: "brand", value: "lamsa" },
    is_active: false,
    state: "inactive",
  }),
  banner({
    id: 4,
    title: "موقعنا",
    link: { type: "url", value: "https://lamsa.sy/about" },
  }),
  banner({ id: 5, title: "الجديد", link: { type: "new", value: null } }),
  banner({ id: 6, title: "بلا رابط", state: "expired" }),
];

const list = (items: unknown[]) => ({
  items,
  page: 1,
  page_size: 100,
  total: items.length,
});

function handlers(extra: Handlers = {}): Handlers {
  return {
    "GET /admin/banners": () => ({ body: rows }),
    "GET /admin/categories": () => ({ body: categoryTree }),
    "GET /admin/brands": () => ({
      body: list([brand({ id: 1, name: "لمسة", slug: "lamsa" })]),
    }),
    "GET /admin/products": () => ({
      body: list([
        listItem({ id: 7, name: "كريم الورد", slug: "rose-cream" }),
        listItem({ id: 8, name: "عطر الياسمين", slug: "jasmine" }),
      ]),
    }),
    "GET /products/rose-cream": () => ({
      body: { id: 7, slug: "rose-cream", name: "كريم الورد" },
    }),
    ...extra,
  };
}

const routes = [{ path: "/banners", element: <BannersPage /> }];

async function selectLinkType(dialog: HTMLElement, label: string) {
  fireEvent.pointerDown(
    within(dialog).getByRole("combobox", { name: "وجهة الرابط" }),
    { button: 0, ctrlKey: false, pointerType: "mouse" },
  );
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

function pickImage(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByTestId("image-input"), {
    target: {
      files: [new File([new Uint8Array(10)], "b.png", { type: "image/png" })],
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: () => "blob:x",
      revokeObjectURL: () => {},
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rowOf = (title: string) =>
  screen.getByText(title, { selector: "button" }).closest("tr") as HTMLElement;

describe("banners list", () => {
  it("shows skeletons, then thumbnail, title, state, dates and the readable link", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/banners");
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);
    await screen.findByText("عرض الورد", { selector: "button" });

    const first = rowOf("عرض الورد");
    expect(first.querySelector("img")).not.toBeNull();
    expect(within(first).getByText("خصم 20%")).toBeInTheDocument();
    expect(within(first).getByText("ظاهر في المتجر")).toBeInTheDocument();
    expect(within(first).getByText("دائم")).toBeInTheDocument();
    // the product's name comes from the public lookup by slug
    expect(
      await within(first).findByText("منتج: كريم الورد"),
    ).toBeInTheDocument();

    const second = rowOf("قسم البشرة");
    expect(within(second).getByText("مجدول")).toBeInTheDocument();
    expect(
      within(second).getByText(/من 01\/12\/2026 10:00/),
    ).toBeInTheDocument();
    expect(
      within(second).getByText(/إلى 10\/12\/2026 10:00/),
    ).toBeInTheDocument();
    expect(
      await within(second).findByText("قسم: العناية بالبشرة"),
    ).toBeInTheDocument();

    expect(
      await within(rowOf("ماركة لمسة")).findByText("ماركة: لمسة"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("ماركة لمسة")).getByText("غير فعّال"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("موقعنا")).getByText("رابط خارجي: https://lamsa.sy/about"),
    ).toBeInTheDocument();
    expect(within(rowOf("الجديد")).getByText("قسم الجديد")).toBeInTheDocument();
    expect(
      within(rowOf("بلا رابط")).getByText("بدون رابط"),
    ).toBeInTheDocument();
    expect(within(rowOf("بلا رابط")).getByText("منتهٍ")).toBeInTheDocument();
  });

  it("warns when a product target is hidden from customers (404 on the public lookup)", async () => {
    mockBackend(
      handlers({
        "GET /products/rose-cream": () => ({
          status: 404,
          body: { error: { code: "PRODUCT_NOT_FOUND", message: "x" } },
        }),
      }),
    );
    renderRoutes(routes, "/banners");
    await screen.findByText("عرض الورد", { selector: "button" });
    expect(
      await within(rowOf("عرض الورد")).findByText(/غير ظاهرة في المتجر/),
    ).toBeInTheDocument();
    expect(
      within(rowOf("عرض الورد")).getByText("منتج: rose-cream"),
    ).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockBackend(handlers({ "GET /admin/banners": () => ({ body: [] }) }));
    renderRoutes(routes, "/banners");
    expect(await screen.findByText("لا توجد بانرات")).toBeInTheDocument();
  });

  it("shows an error state with a retry", async () => {
    mockBackend(
      handlers({
        "GET /admin/banners": () => ({
          status: 500,
          body: { error: { code: "INTERNAL_ERROR", message: "عطل" } },
        }),
      }),
    );
    renderRoutes(routes, "/banners");
    expect(await screen.findByText("عطل")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "إعادة المحاولة" }),
    ).toBeInTheDocument();
  });
});

describe("create and edit: the link target", () => {
  it("creates a banner linked to a product chosen from the search", async () => {
    const calls = mockBackend(
      handlers({
        "POST /admin/banners": () => ({ status: 201, body: banner({ id: 9 }) }),
      }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة بانر" }));
    const dialog = await screen.findByRole("dialog");
    pickImage(dialog);
    fireEvent.change(within(dialog).getByLabelText(/العنوان \*/), {
      target: { value: "بانر جديد" },
    });
    await selectLinkType(dialog, "منتج");
    // searching sends the text to the backend and lists what comes back
    fireEvent.change(within(dialog).getByRole("searchbox"), {
      target: { value: "ورد" },
    });
    // the box is debounced: wait until the backend was really asked for "ورد"
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.path === "/admin/products" &&
            c.url.searchParams.get("q") === "ورد",
        ),
      ).toBe(true),
    );
    fireEvent.click(
      await within(dialog).findByRole("button", { name: /كريم الورد/ }),
    );
    expect(
      within(dialog).getByTestId("banner-link-product-selected"),
    ).toHaveTextContent("rose-cream");
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تمت إضافة البانر."),
    );
    const post = calls.find((c) => c.method === "POST");
    expect(String(post?.body)).toContain('name="link_type"');
    expect(String(post?.body)).toMatch(/name="link_type"\s+product/);
    expect(String(post?.body)).toMatch(/name="link_value"\s+rose-cream/);
    expect(String(post?.body)).toMatch(/name="title"\s+بانر جديد/);
    expect(String(post?.body)).toMatch(/name="is_active"\s+true/);
    expect(
      calls.some(
        (c) =>
          c.path === "/admin/products" && c.url.searchParams.get("q") === "ورد",
      ),
    ).toBe(true);
  });

  it("requires an image and a chosen target before anything is sent", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/banners");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة بانر" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/العنوان \*/), {
      target: { value: "بانر" },
    });
    await selectLinkType(dialog, "ماركة");
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText("اختر الوجهة من القائمة."),
    ).toBeInTheDocument();
    pickImage(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: /لمسة/ }));
    // the brand picker lists the brands; choosing one resolves to its slug
    expect(
      within(dialog).getByTestId("banner-link-brand-selected"),
    ).toHaveTextContent("lamsa");
    fireEvent.click(within(dialog).getByRole("button", { name: "تغيير" }));
    expect(within(dialog).getByRole("searchbox")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("asks for an image when none was chosen", async () => {
    const calls = mockBackend(handlers());
    renderRoutes(routes, "/banners");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة بانر" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/العنوان \*/), {
      target: { value: "بانر" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText("اختر صورة للبانر."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("validates an external URL (https only) and sends a valid one", async () => {
    const calls = mockBackend(
      handlers({
        "POST /admin/banners": () => ({ status: 201, body: banner({ id: 9 }) }),
      }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة بانر" }));
    const dialog = await screen.findByRole("dialog");
    pickImage(dialog);
    fireEvent.change(within(dialog).getByLabelText(/العنوان \*/), {
      target: { value: "رابط" },
    });
    await selectLinkType(dialog, "رابط خارجي");
    const url = within(dialog).getByLabelText("الرابط (https)");
    fireEvent.change(url, { target: { value: "http://insecure.example" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText(/يجب أن يبدأ بـ https/),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    fireEvent.change(url, { target: { value: "https://lamsa.sy/offers" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const body = String(calls.find((c) => c.method === "POST")?.body);
    expect(body).toMatch(/name="link_type"\s+url/);
    expect(body).toMatch(/name="link_value"\s+https:\/\/lamsa\.sy\/offers/);
  });

  it("sends no link value for the types that take none (new, sale)", async () => {
    const calls = mockBackend(
      handlers({
        "POST /admin/banners": () => ({ status: 201, body: banner({ id: 9 }) }),
      }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(await screen.findByRole("button", { name: "إضافة بانر" }));
    const dialog = await screen.findByRole("dialog");
    pickImage(dialog);
    fireEvent.change(within(dialog).getByLabelText(/العنوان \*/), {
      target: { value: "تخفيضات" },
    });
    await selectLinkType(dialog, "التخفيضات");
    expect(within(dialog).queryByRole("searchbox")).toBeNull();
    expect(within(dialog).queryByLabelText("الرابط (https)")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const body = String(calls.find((c) => c.method === "POST")?.body);
    expect(body).toMatch(/name="link_type"\s+sale/);
    expect(body).not.toContain('name="link_value"');
  });

  it("edits a banner's link to a category with PATCH, keeping its window", async () => {
    const calls = mockBackend(
      handlers({
        "PATCH /admin/banners/1": () => ({ body: banner({ id: 1 }) }),
      }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(
      await screen.findByRole("button", { name: /تعديل: عرض الورد/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByTestId("banner-link-product-selected"),
    ).toHaveTextContent("rose-cream");
    await selectLinkType(dialog, "قسم");
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: /^العناية بالبشرة\s*skin-care$/,
      }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حفظ البانر."),
    );
    expect(calls.find((c) => c.method === "PATCH")?.path).toBe(
      "/admin/banners/1",
    );
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
      title: "عرض الورد",
      subtitle: "خصم 20%",
      link: { type: "category", value: "skin-care" },
      is_active: true,
      starts_at: null,
      ends_at: null,
    });
  });

  it("shows the saved target's name (not its slug) when editing", async () => {
    mockBackend(handlers());
    renderRoutes(routes, "/banners");
    fireEvent.click(
      await screen.findByRole("button", { name: /تعديل: عرض الورد/ }),
    );
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(
        within(dialog).getByTestId("banner-link-product-selected"),
      ).toHaveTextContent("كريم الورد"),
    );
  });

  it("converts the window between store time and UTC when editing", async () => {
    const calls = mockBackend(
      handlers({
        "PATCH /admin/banners/2": () => ({ body: banner({ id: 2 }) }),
      }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(
      await screen.findByRole("button", { name: /تعديل: قسم البشرة/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      (within(dialog).getByLabelText("يبدأ في") as HTMLInputElement).value,
    ).toBe("2026-12-01T10:00");
    fireEvent.change(within(dialog).getByLabelText("ينتهي في"), {
      target: { value: "2026-12-11T10:00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
      link: { type: "category", value: "skin-care" },
      starts_at: "2026-12-01T07:00:00Z",
      ends_at: "2026-12-11T07:00:00Z",
    });
  });

  it("puts an INVALID_LINK error from the backend on the link field", async () => {
    mockBackend(
      handlers({
        "PATCH /admin/banners/4": () => ({
          status: 422,
          body: {
            error: {
              code: "INVALID_LINK",
              message: "الرابط غير صالح: لا يوجد عنصر بهذا المعرّف.",
              details: { reason: "no such slug" },
            },
          },
        }),
      }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(
      await screen.findByRole("button", { name: /تعديل: موقعنا/ }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText(
        "الرابط غير صالح: لا يوجد عنصر بهذا المعرّف.",
      ),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("replaces the image of an existing banner right away", async () => {
    const calls = mockBackend(
      handlers({
        "PUT /admin/banners/1/image": () => ({ body: banner({ id: 1 }) }),
      }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(
      await screen.findByRole("button", { name: /تعديل: عرض الورد/ }),
    );
    const dialog = await screen.findByRole("dialog");
    pickImage(dialog);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم تحديث الصورة."),
    );
    expect(
      calls.some(
        (c) => c.method === "PUT" && c.path === "/admin/banners/1/image",
      ),
    ).toBe(true);
  });
});

describe("activate, reorder and delete", () => {
  it("toggles active with a PATCH of is_active only", async () => {
    const calls = mockBackend(
      handlers({
        "PATCH /admin/banners/1": () => ({ body: banner({ id: 1 }) }),
      }),
    );
    renderRoutes(routes, "/banners");
    await screen.findByText("عرض الورد", { selector: "button" });
    fireEvent.click(screen.getByRole("switch", { name: /فعّال: عرض الورد/ }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم إيقاف البانر."),
    );
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      is_active: false,
    });
  });

  it("moves a banner down with one reorder call carrying every id", async () => {
    const calls = mockBackend(
      handlers({
        "PUT /admin/banners/order": () => ({ body: rows }),
      }),
    );
    renderRoutes(routes, "/banners");
    await screen.findByText("عرض الورد", { selector: "button" });
    expect(
      screen.getByRole("button", { name: /نقل للأعلى: عرض الورد/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /نقل للأسفل: بلا رابط/ }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: /نقل للأسفل: عرض الورد/ }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم تحديث الترتيب."),
    );
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
      banner_ids: [2, 1, 3, 4, 5, 6],
    });
  });

  it("deletes only after the confirmation", async () => {
    const calls = mockBackend(
      handlers({ "DELETE /admin/banners/3": () => ({ status: 204 }) }),
    );
    renderRoutes(routes, "/banners");
    fireEvent.click(
      await screen.findByRole("button", { name: /حذف: ماركة لمسة/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "إلغاء" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /حذف: ماركة لمسة/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "حذف",
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("تم حذف البانر."),
    );
    expect(calls.find((c) => c.method === "DELETE")?.path).toBe(
      "/admin/banners/3",
    );
  });
});
