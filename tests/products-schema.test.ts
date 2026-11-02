import { describe, expect, it } from "vitest";

import type {
  CategoryAttribute,
  CategoryVariantOption,
} from "@/features/categories";
import { EMPTY_FORM } from "@/features/products/payload";
import {
  buildProductSchema,
  isValidPrice,
  isValidStock,
  type ProductFormValues,
} from "@/features/products/schema";

const attr = (over: Partial<CategoryAttribute>): CategoryAttribute => ({
  id: 1,
  category_id: 1,
  key: "volume",
  label: "الحجم",
  type: "number",
  options: null,
  unit: "ml",
  is_required: false,
  is_filterable: false,
  sort_order: 0,
  inherited: false,
  ...over,
});
const option = (
  over: Partial<CategoryVariantOption>,
): CategoryVariantOption => ({
  id: 1,
  category_id: 1,
  key: "color",
  label: "اللون",
  type: "color",
  options: null,
  sort_order: 0,
  inherited: false,
  ...over,
});

function run(
  values: Partial<ProductFormValues>,
  ctx: Partial<Parameters<typeof buildProductSchema>[0]> = {},
) {
  const schema = buildProductSchema({
    mode: "create",
    attributes: [],
    options: [],
    ...ctx,
  });
  const result = schema.safeParse({ ...EMPTY_FORM, ...values });
  const errors: Record<string, string> = {};
  if (!result.success)
    for (const issue of result.error.issues)
      errors[issue.path.join(".")] = issue.message;
  return { ok: result.success, errors };
}

const valid: Partial<ProductFormValues> = {
  name: "كريم مرطب",
  category_id: "3",
  price: "15000",
  stock: "10",
};

describe("price and stock formats", () => {
  it("SYP is whole pounds, USD allows two decimals, both cap at 13 digits", () => {
    expect(isValidPrice("15000", "SYP")).toBe(true);
    expect(isValidPrice("15000.5", "SYP")).toBe(false);
    expect(isValidPrice("8.95", "USD")).toBe(true);
    expect(isValidPrice("8.955", "USD")).toBe(false);
    expect(isValidPrice("-1", "USD")).toBe(false);
    expect(isValidPrice("1".repeat(14), "SYP")).toBe(false);
    expect(isValidPrice("", "SYP")).toBe(false);
  });
  it("stock is an integer from 0 to 1,000,000", () => {
    expect(isValidStock("0")).toBe(true);
    expect(isValidStock("1000000")).toBe(true);
    expect(isValidStock("1000001")).toBe(false);
    expect(isValidStock("1.5")).toBe(false);
    expect(isValidStock("-1")).toBe(false);
  });
});

describe("simple product", () => {
  it("accepts a valid product", () => {
    expect(run(valid).ok).toBe(true);
  });
  it("requires name, category, price and stock", () => {
    const { errors } = run({ stock: "", price: "" });
    expect(errors.name).toBeTruthy();
    expect(errors.category_id).toBeTruthy();
    expect(errors.price).toBeTruthy();
    expect(errors.stock).toBeTruthy();
  });
  it("limits name to 200 characters and description to 20,000", () => {
    expect(run({ ...valid, name: "ا".repeat(201) }).errors.name).toBeTruthy();
    expect(run({ ...valid, name: "ا".repeat(200) }).ok).toBe(true);
    expect(
      run({ ...valid, description: "x".repeat(20_001) }).errors.description,
    ).toBeTruthy();
  });
  it("uses the currency's price format", () => {
    expect(
      run({ ...valid, price: "9.99", currency: "SYP" }).errors.price,
    ).toBeTruthy();
    expect(run({ ...valid, price: "9.99", currency: "USD" }).ok).toBe(true);
  });
  it("requires the sale price to be lower than the price", () => {
    expect(
      run({ ...valid, sale_price: "15000" }).errors.sale_price,
    ).toBeTruthy();
    expect(
      run({ ...valid, sale_price: "20000" }).errors.sale_price,
    ).toBeTruthy();
    expect(run({ ...valid, sale_price: "12000" }).ok).toBe(true);
  });
  it("does not ask for stock when editing (it changes through stock-adjust)", () => {
    expect(run({ ...valid, stock: "" }, { mode: "edit" }).ok).toBe(true);
  });
  it("limits sku to 64 and slug to 120 characters", () => {
    expect(run({ ...valid, sku: "A".repeat(65) }).errors.sku).toBeTruthy();
    expect(run({ ...valid, slug: "a".repeat(121) }).errors.slug).toBeTruthy();
  });
});

describe("category attributes", () => {
  it("requires required attributes and validates numbers", () => {
    const attributes = [attr({ key: "volume", is_required: true })];
    expect(run(valid, { attributes }).errors["attributes.volume"]).toBeTruthy();
    expect(
      run({ ...valid, attributes: { volume: "abc" } }, { attributes }).errors[
        "attributes.volume"
      ],
    ).toBeTruthy();
    expect(
      run({ ...valid, attributes: { volume: "50" } }, { attributes }).ok,
    ).toBe(true);
  });
  it("lets optional attributes stay empty", () => {
    expect(run(valid, { attributes: [attr({ is_required: false })] }).ok).toBe(
      true,
    );
  });
});

describe("variable product", () => {
  const options = [option({})];
  const variant = (over = {}) => ({
    options: { color: "أحمر", color_hex: "#AA0000" },
    sku: "",
    price: "5000",
    sale_price: "",
    stock: "3",
    is_active: true,
    ...over,
  });
  const base: Partial<ProductFormValues> = {
    ...valid,
    type: "variable",
    price: "",
  };

  it("needs at least one variant", () => {
    expect(run(base, { options }).errors.variants).toBeTruthy();
  });
  it("accepts valid variants and ignores the top-level price", () => {
    expect(run({ ...base, variants: [variant()] }, { options }).ok).toBe(true);
  });
  it("validates each variant's option value, color hex, price and stock", () => {
    const { errors } = run(
      {
        ...base,
        variants: [
          variant({
            options: { color: "", color_hex: "red" },
            price: "",
            stock: "x",
          }),
        ],
      },
      { options },
    );
    expect(errors["variants.0.options.color"]).toBeTruthy();
    expect(errors["variants.0.options.color_hex"]).toBeTruthy();
    expect(errors["variants.0.price"]).toBeTruthy();
    expect(errors["variants.0.stock"]).toBeTruthy();
  });
  it("rejects duplicate option combinations", () => {
    const { errors } = run(
      { ...base, variants: [variant(), variant()] },
      { options },
    );
    expect(errors["variants.1.options"]).toBeTruthy();
  });
  it("does not validate stock of an existing variant on edit", () => {
    expect(
      run(
        { ...base, variants: [variant({ id: 5, stock: "" })] },
        { options, mode: "edit" },
      ).ok,
    ).toBe(true);
  });
});
