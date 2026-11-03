import { describe, expect, it } from "vitest";

import {
  buildBundleItems,
  bundleItemsChanged,
  bundleRowError,
  bundleSaving,
  bundleTotal,
  componentUnitPrice,
  duplicateIndexes,
  effectiveBundlePrice,
  hasBundleItem,
  parseQuantity,
  variantLabel,
} from "@/features/products/bundle";
import { buildCreatePayload, EMPTY_FORM } from "@/features/products/payload";
import { buildProductSchema } from "@/features/products/schema";
import type { AdminProduct } from "@/features/products/types";
import { ApiError } from "@/lib/errors";
import { multiplyAmount, subtractAmounts } from "@/lib/money";

const item = (
  product_id: number,
  variant_id: number | null,
  quantity = "1",
) => ({
  product_id,
  variant_id,
  quantity,
  name: `p${product_id}`,
  variant_label: null,
});

describe("quantity and duplicates", () => {
  it("accepts whole numbers 1-99 only", () => {
    expect(parseQuantity("1")).toBe(1);
    expect(parseQuantity(" 99 ")).toBe(99);
    for (const bad of ["0", "100", "-1", "1.5", "", "abc", "٣"])
      expect(parseQuantity(bad)).toBeNull();
  });

  it("treats the same product with another variant as a different line", () => {
    expect(hasBundleItem([item(1, 5)], { product_id: 1, variant_id: 6 })).toBe(
      false,
    );
    expect(hasBundleItem([item(1, 5)], { product_id: 1, variant_id: 5 })).toBe(
      true,
    );
    expect(
      hasBundleItem([item(2, null)], { product_id: 2, variant_id: null }),
    ).toBe(true);
  });

  it("lists the indexes of repeated lines", () => {
    expect(
      duplicateIndexes([
        item(1, null),
        item(2, null),
        item(1, null),
        item(1, null),
      ]),
    ).toEqual([2, 3]);
  });
});

describe("running total", () => {
  it("multiplies price by quantity without floating point", () => {
    expect(multiplyAmount("0.10", 3)).toBe("0.30");
    expect(multiplyAmount("15000.00", 2)).toBe("30000.00");
    expect(subtractAmounts("31000.00", "20000")).toBe("11000.00");
  });

  it("sums only lines in the bundle's currency and counts the rest as skipped", () => {
    const total = bundleTotal(
      [
        { unitPrice: "8000.00", currency: "SYP", quantity: 2 },
        { unitPrice: "15000.00", currency: "SYP", quantity: 1 },
        { unitPrice: "5.00", currency: "USD", quantity: 1 },
        { unitPrice: null, currency: null, quantity: 1 },
      ],
      "SYP",
    );
    expect(total).toEqual({ amount: "31000.00", skipped: 2 });
  });

  it("is zero for no lines, and the saving is negative when the bundle costs more", () => {
    expect(bundleTotal([], "SYP").amount).toBe("0.00");
    expect(bundleSaving("31000.00", "20000")).toBe("11000.00");
    expect(bundleSaving("10000.00", "12000")).toBe("-2000.00");
  });

  it("uses the sale price when set and valid, else the price", () => {
    expect(effectiveBundlePrice("20000", "")).toBe("20000");
    expect(effectiveBundlePrice("20000", "18000")).toBe("18000");
    expect(effectiveBundlePrice("", "")).toBeNull();
    expect(effectiveBundlePrice("abc", "")).toBeNull();
  });

  it("reads a component's unit price from its detail", () => {
    const simple = { type: "simple", price_from: "8000.00", variants: [] };
    const variable = {
      type: "variable",
      price_from: "5000.00",
      variants: [
        { id: 7, current_price: "9000.00" },
        { id: 8, current_price: "5000.00" },
      ],
    };
    expect(componentUnitPrice(simple as unknown as AdminProduct, null)).toBe(
      "8000.00",
    );
    expect(componentUnitPrice(variable as unknown as AdminProduct, 7)).toBe(
      "9000.00",
    );
    expect(
      componentUnitPrice(variable as unknown as AdminProduct, 99),
    ).toBeNull();
  });

  it("labels a variant from its option values, skipping color hex helpers", () => {
    expect(
      variantLabel({ color: "أحمر", color_hex: "#FF0000", size: "L" }),
    ).toBe("أحمر، L");
  });
});

describe("payload and change detection", () => {
  it("builds the PUT items with numeric quantities", () => {
    expect(buildBundleItems([item(1, null, "2"), item(2, 9, "1")])).toEqual([
      { product_id: 1, variant_id: null, quantity: 2 },
      { product_id: 2, variant_id: 9, quantity: 1 },
    ]);
  });

  it("detects added, removed and changed lines", () => {
    const base = [{ product_id: 1, variant_id: null, quantity: 1 }];
    expect(bundleItemsChanged(base, [...base])).toBe(false);
    expect(bundleItemsChanged(base, [])).toBe(true);
    expect(
      bundleItemsChanged(base, [
        { product_id: 1, variant_id: null, quantity: 2 },
      ]),
    ).toBe(true);
    expect(
      bundleItemsChanged(base, [{ product_id: 1, variant_id: 3, quantity: 1 }]),
    ).toBe(true);
  });

  it("sends bundle_items inline on create, and only for bundles", () => {
    const values = {
      ...EMPTY_FORM,
      type: "bundle" as const,
      name: "علبة",
      category_id: "3",
      price: "20000",
      bundle_items: [item(1, null, "2")],
    };
    const defs = { attributes: [], options: [] };
    expect(buildCreatePayload(values, defs).bundle_items).toEqual([
      { product_id: 1, variant_id: null, quantity: 2 },
    ]);
    expect(
      buildCreatePayload({ ...values, type: "simple" }, defs).bundle_items,
    ).toBeUndefined();
  });
});

describe("schema", () => {
  const schema = buildProductSchema({
    mode: "create",
    attributes: [],
    options: [],
  });
  const base = {
    ...EMPTY_FORM,
    type: "bundle" as const,
    name: "علبة",
    category_id: "3",
    price: "20000",
  };

  it("accepts an empty bundle (the backend allows it)", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it("flags a bad quantity and a duplicate on their lines", () => {
    const result = schema.safeParse({
      ...base,
      bundle_items: [item(1, null, "0"), item(2, null), item(2, null)],
    });
    expect(result.success).toBe(false);
    const paths =
      result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
    expect(paths).toContain("bundle_items.0.quantity");
    expect(paths).toContain("bundle_items.2");
  });

  it("ignores bundle lines for other types", () => {
    expect(
      schema.safeParse({
        ...base,
        type: "simple",
        stock: "1",
        bundle_items: [item(1, null, "0")],
      }).success,
    ).toBe(true);
  });
});

describe("bundle error mapping", () => {
  const err = (code: string, details: unknown) =>
    new ApiError(422, code, "x", details);

  it("maps INVALID_BUNDLE_ITEM reasons to Arabic on the named line", () => {
    expect(
      bundleRowError(
        err("INVALID_BUNDLE_ITEM", {
          index: 2,
          reason: "a bundle cannot contain another bundle",
        }),
      ),
    ).toEqual({ index: 2, message: "لا يمكن وضع علبة هدايا داخل علبة أخرى." });
    expect(
      bundleRowError(
        err("INVALID_BUNDLE_ITEM", {
          index: 0,
          reason: "variant_id is required for a variable product",
        }),
      )?.message,
    ).toBe("اختر خياراً لهذا المنتج.");
  });

  it("maps a currency mismatch to the line", () => {
    expect(
      bundleRowError(
        err("BUNDLE_CURRENCY_MISMATCH", {
          index: 1,
          bundle_currency: "SYP",
          component_currency: "USD",
        }),
      ),
    ).toEqual({ index: 1, message: "هذا المنتج غير متاح بنفس عملة العلبة." });
  });

  it("returns null when no line is named or it is another error", () => {
    expect(bundleRowError(err("BUNDLE_CURRENCY_MISMATCH", null))).toBeNull();
    expect(bundleRowError(err("SKU_TAKEN", { index: 0 }))).toBeNull();
    expect(bundleRowError(new Error("x"))).toBeNull();
  });
});
