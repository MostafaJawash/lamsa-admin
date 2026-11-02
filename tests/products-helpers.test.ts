import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/errors";
import { amountRange, normalizeAmount } from "@/lib/money";
import {
  DEFAULT_PARAMS,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
} from "@/features/products/list-filters";
import { applyApiError, publishReasons } from "@/features/products/map-errors";
import {
  buildCreatePayload,
  buildUpdatePayload,
  diffVariants,
  EMPTY_FORM,
  emptyVariant,
} from "@/features/products/payload";
import {
  priceRangeText,
  stockCell,
  variantPriceRange,
} from "@/features/products/price";
import { moveItem, validateImageFiles } from "@/features/products/images";
import type { AdminVariant, ProductListItem } from "@/features/products/types";

describe("price range helpers", () => {
  it("shows one price when all are equal", () => {
    expect(priceRangeText(["5000.00", "5000.00"], "SYP")).toBe("5,000 ل.س");
  });
  it("shows 'من X إلى Y' for different prices, in the product's own currency", () => {
    expect(priceRangeText(["15000.00", "5000.00", "9000.00"], "SYP")).toBe(
      "من 5,000 ل.س إلى 15,000 ل.س",
    );
    expect(priceRangeText(["8.50", "12.00"], "USD")).toBe("من 8.5 $ إلى 12 $");
  });
  it("compares numerically, not as text", () => {
    expect(amountRange(["900.00", "10000.00"])).toEqual({
      min: "900.00",
      max: "10000.00",
    });
  });
  it("returns null with nothing to show", () => {
    expect(priceRangeText([], "SYP")).toBeNull();
    expect(variantPriceRange([], "USD")).toBeNull();
  });
  it("uses the variants' current (sale) price", () => {
    const variants = [
      { current_price: "4000.00" },
      { current_price: "6000.00" },
    ];
    expect(variantPriceRange(variants, "SYP")).toBe(
      "من 4,000 ل.س إلى 6,000 ل.س",
    );
  });
  it("normalizes amounts", () => {
    expect(normalizeAmount("150000")).toBe("150000.00");
    expect(normalizeAmount("8.5")).toBe("8.50");
    expect(normalizeAmount("x")).toBeNull();
  });
});

describe("stockCell", () => {
  const item = (over: Partial<ProductListItem>) =>
    ({ type: "simple", stock: 4, ...over }) as ProductListItem;
  it("marks variable products as multiple and bundles as none", () => {
    expect(stockCell(item({}))).toEqual({ value: 4, multiple: false });
    expect(stockCell(item({ type: "variable", stock: 9 }))).toEqual({
      value: 9,
      multiple: true,
    });
    expect(stockCell(item({ type: "bundle", stock: null }))).toEqual({
      value: null,
      multiple: false,
    });
  });
});

describe("list URL state", () => {
  it("defaults when the URL is empty or invalid", () => {
    expect(parseListParams(new URLSearchParams(""))).toEqual(DEFAULT_PARAMS);
    expect(
      parseListParams(
        new URLSearchParams("page=-3&sort=evil&status=x&category=abc"),
      ),
    ).toEqual(DEFAULT_PARAMS);
  });
  it("round-trips and omits defaults", () => {
    const params = {
      ...DEFAULT_PARAMS,
      page: 3,
      q: "كريم",
      category: 4,
      brand: 2,
      status: "active" as const,
      type: "variable" as const,
      sort: "name" as const,
    };
    const search = toSearchParams(params);
    expect(parseListParams(search)).toEqual(params);
    expect(toSearchParams(DEFAULT_PARAMS).toString()).toBe("");
    expect(hasActiveFilters(params)).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, page: 2 })).toBe(false);
  });
});

const defs = {
  attributes: [],
  options: [
    {
      id: 1,
      category_id: 1,
      key: "color",
      label: "اللون",
      type: "color" as const,
      options: null,
      sort_order: 0,
      inherited: false,
    },
  ],
};

describe("payloads", () => {
  it("builds a simple create body (inactive, stock, no variants)", () => {
    const body = buildCreatePayload(
      {
        ...EMPTY_FORM,
        name: " كريم ",
        category_id: "3",
        price: "1000",
        stock: "5",
      },
      defs,
    );
    expect(body).toMatchObject({
      type: "simple",
      name: "كريم",
      category_id: 3,
      brand_id: null,
      price: "1000",
      stock: 5,
      is_active: false,
    });
    expect(body.variants).toBeUndefined();
    expect(body.sku).toBeUndefined();
  });
  it("builds a variable create body with nested variants and no top-level price", () => {
    const variant = {
      ...emptyVariant(defs.options),
      options: { color: "أحمر", color_hex: "#aa0000" },
      price: "500",
      stock: "2",
    };
    const body = buildCreatePayload(
      {
        ...EMPTY_FORM,
        type: "variable",
        name: "ن",
        category_id: "1",
        variants: [variant],
      },
      defs,
    );
    expect(body.price).toBeUndefined();
    expect(body.stock).toBeUndefined();
    expect(body.variants?.[0]).toMatchObject({
      options: { color: "أحمر", color_hex: "#AA0000" },
      price: "500",
      stock: 2,
    });
  });
  it("never sends stock on update and only sends is_active when it changed", () => {
    const values = {
      ...EMPTY_FORM,
      name: "ن",
      category_id: "1",
      price: "10",
      stock: "99",
      is_active: true,
    };
    const same = buildUpdatePayload(values, defs, true);
    expect("stock" in same).toBe(false);
    expect("is_active" in same).toBe(false);
    expect(buildUpdatePayload(values, defs, false).is_active).toBe(true);
    expect(
      buildUpdatePayload({ ...values, sale_price: "" }, defs, true).sale_price,
    ).toBeNull();
  });
});

describe("diffVariants", () => {
  const before = (
    id: number,
    color: string,
    price: string,
    stock = 1,
  ): AdminVariant =>
    ({
      id,
      sku: `LM-${id}`,
      options: { color, color_hex: "#AA0000" },
      price,
      sale_price: null,
      stock,
      is_active: true,
      sort_order: id - 1,
    }) as unknown as AdminVariant;
  const row = (id: number | undefined, color: string, price: string) => ({
    id,
    options: { color, color_hex: "#AA0000" },
    sku: id ? `LM-${id}` : "",
    price,
    sale_price: "",
    stock: "1",
    is_active: true,
  });

  it("finds nothing to do when nothing changed", () => {
    const diff = diffVariants(
      [before(1, "أحمر", "5000.00")],
      [row(1, "أحمر", "5000")],
      defs.options,
    );
    expect(diff).toEqual({ remove: [], patch: [], add: [] });
  });
  it("patches changed fields only, adds new rows and removes dropped ones", () => {
    const diff = diffVariants(
      [before(1, "أحمر", "5000.00"), before(2, "أزرق", "6000.00")],
      [row(1, "أحمر", "5500"), row(undefined, "أخضر", "700")],
      defs.options,
    );
    expect(diff.patch).toEqual([{ id: 1, body: { price: "5500" } }]);
    expect(diff.add).toHaveLength(1);
    expect(diff.add[0]?.options.color).toBe("أخضر");
    expect(diff.remove).toEqual([2]);
  });
});

describe("applyApiError", () => {
  const collect = () => {
    const calls: [string, string][] = [];
    const setError = ((name: string, error: { message?: string }) => {
      calls.push([name, error.message ?? ""]);
    }) as never;
    return { calls, setError };
  };
  it("maps 422 field details (dotted paths) to form fields", () => {
    const { calls, setError } = collect();
    const error = new ApiError(422, "VALIDATION_ERROR", "x", [
      { field: "variants.0.price", message: "must be between 0 and 1" },
      { field: "name", message: "too long" },
      { field: "files", message: "send 1..8 files" },
    ]);
    const unmapped = applyApiError(error, setError);
    expect(calls).toEqual([
      ["variants.0.price", "must be between 0 and 1"],
      ["name", "too long"],
    ]);
    expect(unmapped).toEqual(["send 1..8 files"]);
  });
  it("maps attribute, SKU and slug errors by code", () => {
    const { calls, setError } = collect();
    applyApiError(
      new ApiError(422, "INVALID_ATTRIBUTE_VALUE", "قيمة غير صحيحة", {
        key: "volume",
      }),
      setError,
    );
    applyApiError(
      new ApiError(422, "MISSING_REQUIRED_ATTRIBUTE", "ناقصة", {
        keys: ["a", "b"],
      }),
      setError,
    );
    applyApiError(new ApiError(409, "SKU_TAKEN", "الرمز مستخدم"), setError);
    applyApiError(new ApiError(409, "SLUG_TAKEN", "الرابط مستخدم"), setError);
    expect(calls.map(([name]) => name)).toEqual([
      "attributes.volume",
      "attributes.a",
      "attributes.b",
      "sku",
      "slug",
    ]);
  });
  it("leaves unknown errors for a toast", () => {
    const { calls, setError } = collect();
    expect(
      applyApiError(new ApiError(500, "INTERNAL_ERROR", "عطل"), setError),
    ).toEqual(["عطل"]);
    expect(calls).toEqual([]);
  });
  it("turns publish reasons into Arabic", () => {
    const error = new ApiError(422, "PRODUCT_NOT_PUBLISHABLE", null, {
      reasons: ["NO_IMAGES"],
    });
    expect(publishReasons(error)).toEqual(["أضف صورة واحدة على الأقل."]);
    expect(publishReasons(new Error("x"))).toEqual([]);
  });
});

describe("images", () => {
  const file = (name: string, type: string, size = 100) =>
    new File([new Uint8Array(size)], name, { type });
  it("accepts JPEG/PNG/WEBP up to 5 MB and rejects the rest with a reason", () => {
    const { accepted, errors } = validateImageFiles(
      [
        file("a.jpg", "image/jpeg"),
        file("b.gif", "image/gif"),
        file("c.png", "image/png", 5 * 1024 * 1024 + 1),
      ],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(["a.jpg"]);
    expect(errors).toHaveLength(2);
  });
  it("stops at 15 images per product", () => {
    const files = Array.from({ length: 4 }, (_, i) =>
      file(`${i}.png`, "image/png"),
    );
    const { accepted, errors } = validateImageFiles(files, 13);
    expect(accepted).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });
  it("moves items within range only", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
  });
});
