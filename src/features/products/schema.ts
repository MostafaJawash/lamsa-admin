import { z } from "zod";

import type {
  CategoryAttribute,
  CategoryVariantOption,
} from "@/features/categories";
import { isLowerAmount } from "@/lib/money";
import { m } from "@/messages";

import { BUNDLE_LIMITS, duplicateIndexes, parseQuantity } from "./bundle";

import type { CurrencyCode } from "./types";

/** Limits copied from the backend's Pydantic schemas (app/modules/products/schemas.py). */
export const LIMITS = {
  name: 200,
  description: 20_000,
  sku: 64,
  slug: 120,
  stock: 1_000_000,
  optionValue: 50,
  attributeText: 1000,
} as const;

const SYP_PRICE = /^\d{1,13}$/;
const USD_PRICE = /^\d{1,13}(\.\d{1,2})?$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** SYP is whole pounds (UI convention); USD allows up to two decimals. Backend max: 13 digits. */
export function isValidPrice(value: string, currency: CurrencyCode): boolean {
  return (currency === "SYP" ? SYP_PRICE : USD_PRICE).test(value.trim());
}

export function isValidStock(value: string): boolean {
  const text = value.trim();
  return /^\d{1,7}$/.test(text) && Number(text) <= LIMITS.stock;
}

const variantSchema = z.object({
  /** Present for variants that already exist on the backend. */
  id: z.number().optional(),
  options: z.record(z.string(), z.string()),
  sku: z.string(),
  price: z.string(),
  sale_price: z.string(),
  stock: z.string(),
  is_active: z.boolean(),
});

const bundleItemSchema = z.object({
  product_id: z.number(),
  variant_id: z.number().nullable(),
  quantity: z.string(),
  name: z.string(),
  variant_label: z.string().nullable(),
});

const baseSchema = z.object({
  type: z.enum(["simple", "variable", "bundle"]),
  currency: z.enum(["SYP", "USD"]),
  name: z.string(),
  description: z.string(),
  category_id: z.string(),
  brand_id: z.string(),
  sku: z.string(),
  slug: z.string(),
  price: z.string(),
  sale_price: z.string(),
  stock: z.string(),
  is_new: z.boolean(),
  is_active: z.boolean(),
  attributes: z.record(z.string(), z.unknown()),
  variants: z.array(variantSchema),
  bundle_items: z.array(bundleItemSchema),
});

export type ProductFormValues = z.infer<typeof baseSchema>;
export type VariantFormValues = z.infer<typeof variantSchema>;

export type SchemaContext = {
  mode: "create" | "edit";
  attributes: readonly CategoryAttribute[];
  options: readonly CategoryVariantOption[];
};

export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Stable text key of a variant's option values; used to catch duplicates before the backend does. */
export function optionsSignature(
  options: Readonly<Record<string, string>>,
  definitions: readonly CategoryVariantOption[],
): string {
  return definitions
    .map((def) => (options[def.key] ?? "").trim().toLowerCase())
    .join("|");
}

/**
 * The form's zod schema. Required fields, lengths and price formats follow the backend;
 * the category's attribute and variant-option definitions (which vary per category) are
 * passed in. Stock is only validated where it is typed (create, or a new variant): on an
 * existing product it changes through the stock-adjust endpoint.
 */
export function buildProductSchema({
  mode,
  attributes,
  options,
}: SchemaContext) {
  const v = m.products.form.validation;
  return baseSchema.superRefine((values, ctx) => {
    const fail = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const currency = values.currency;

    const name = values.name.trim();
    if (!name) fail(["name"], v.nameRequired);
    else if (name.length > LIMITS.name) fail(["name"], v.nameMax);
    if (values.description.length > LIMITS.description)
      fail(["description"], v.descriptionMax);
    if (!values.category_id) fail(["category_id"], v.categoryRequired);
    if (values.sku.trim().length > LIMITS.sku) fail(["sku"], v.skuMax);
    if (values.slug.trim().length > LIMITS.slug) fail(["slug"], v.slugMax);

    const checkPrice = (
      price: string,
      sale: string,
      path: (string | number)[],
    ) => {
      const priceText = price.trim();
      if (!priceText) fail([...path, "price"], v.priceRequired);
      else if (!isValidPrice(priceText, currency))
        fail([...path, "price"], currency === "SYP" ? v.priceSyp : v.priceUsd);
      const saleText = sale.trim();
      if (!saleText) return;
      if (!isValidPrice(saleText, currency))
        fail(
          [...path, "sale_price"],
          currency === "SYP" ? v.priceSyp : v.priceUsd,
        );
      else if (
        isValidPrice(priceText, currency) &&
        !isLowerAmount(saleText, priceText)
      )
        fail([...path, "sale_price"], v.salePriceLower);
    };
    const checkStock = (stock: string, path: (string | number)[]) => {
      if (!stock.trim()) fail([...path, "stock"], v.stockRequired);
      else if (!isValidStock(stock)) fail([...path, "stock"], v.stockInvalid);
    };

    if (values.type === "variable") {
      if (values.variants.length === 0) fail(["variants"], v.variantsRequired);
      const seen = new Set<string>();
      values.variants.forEach((variant, index) => {
        const base = ["variants", index];
        for (const def of options) {
          const value = (variant.options[def.key] ?? "").trim();
          if (!value) fail([...base, "options", def.key], v.optionRequired);
          else if (value.length > LIMITS.optionValue)
            fail([...base, "options", def.key], v.optionMax);
          if (def.type === "color") {
            const hex = variant.options[`${def.key}_hex`] ?? "";
            if (!HEX.test(hex))
              fail([...base, "options", `${def.key}_hex`], v.hexInvalid);
          }
        }
        if (variant.sku.trim().length > LIMITS.sku)
          fail([...base, "sku"], v.skuMax);
        checkPrice(variant.price, variant.sale_price, base);
        if (mode === "create" || variant.id === undefined)
          checkStock(variant.stock, base);
        const signature = optionsSignature(variant.options, options);
        if (seen.has(signature)) fail([...base, "options"], v.variantDuplicate);
        seen.add(signature);
      });
    } else {
      checkPrice(values.price, values.sale_price, []);
      if (values.type === "simple" && mode === "create")
        checkStock(values.stock, []);
    }

    if (values.type === "bundle") {
      const b = m.products.bundle;
      if (values.bundle_items.length > BUNDLE_LIMITS.maxItems)
        fail(["bundle_items"], b.maxItems);
      values.bundle_items.forEach((item, index) => {
        if (parseQuantity(item.quantity) === null)
          fail(["bundle_items", index, "quantity"], b.quantityInvalid);
      });
      for (const index of duplicateIndexes(values.bundle_items))
        fail(["bundle_items", index], b.duplicate);
    }

    for (const def of attributes) {
      const value = values.attributes[def.key];
      const path = ["attributes", def.key];
      if (isEmptyValue(value)) {
        if (def.is_required) fail(path, v.attributeRequired);
        continue;
      }
      if (
        def.type === "number" &&
        !/^-?\d+(\.\d+)?$/.test(String(value).trim())
      )
        fail(path, v.attributeNumber);
      if (
        def.type === "text" &&
        String(value).trim().length > LIMITS.attributeText
      )
        fail(path, v.attributeTextMax);
    }
  });
}
