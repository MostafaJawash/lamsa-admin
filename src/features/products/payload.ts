import type {
  CategoryAttribute,
  CategoryVariantOption,
} from "@/features/categories";
import { normalizeAmount } from "@/lib/money";

import { buildBundleItems, bundleToFormItems } from "./bundle";

import {
  isEmptyValue,
  type ProductFormValues,
  type VariantFormValues,
} from "./schema";
import type {
  AdminProduct,
  AdminVariant,
  CurrencyCode,
  ProductCreateBody,
  ProductType,
  ProductUpdateBody,
  VariantCreateBody,
  VariantUpdateBody,
} from "./types";

export type Definitions = {
  attributes: readonly CategoryAttribute[];
  options: readonly CategoryVariantOption[];
};

/** "150000.00" -> "150000" for SYP; USD keeps cents but drops a ".00". */
export function amountToInput(
  amount: string | null | undefined,
  _currency?: CurrencyCode,
): string {
  if (!amount) return "";
  return amount.replace(/\.00$/, "");
}

export function emptyVariant(
  definitions: readonly CategoryVariantOption[],
): VariantFormValues {
  const options: Record<string, string> = {};
  for (const def of definitions) {
    options[def.key] = "";
    if (def.type === "color") options[`${def.key}_hex`] = "#000000";
  }
  return {
    options,
    sku: "",
    price: "",
    sale_price: "",
    stock: "0",
    is_active: true,
  };
}

export const EMPTY_FORM: ProductFormValues = {
  type: "simple",
  currency: "SYP",
  name: "",
  description: "",
  category_id: "",
  brand_id: "",
  sku: "",
  slug: "",
  price: "",
  sale_price: "",
  stock: "0",
  is_new: false,
  is_active: false,
  attributes: {},
  variants: [],
  bundle_items: [],
};

function attributeToInput(value: unknown): unknown {
  if (typeof value === "number") return String(value);
  return value;
}

/** Form values from a loaded product (edit page). */
export function productToFormValues(product: AdminProduct): ProductFormValues {
  const currency = product.currency as CurrencyCode;
  return {
    type: product.type as ProductType,
    currency,
    name: product.name,
    description: product.description ?? "",
    category_id: String(product.category.id),
    brand_id: product.brand ? String(product.brand.id) : "",
    sku: product.sku ?? "",
    slug: product.slug,
    price: amountToInput(product.price, currency),
    sale_price: amountToInput(product.sale_price, currency),
    stock: product.stock === null ? "0" : String(product.stock),
    is_new: product.is_new,
    is_active: product.is_active,
    attributes: Object.fromEntries(
      Object.entries(product.attributes).map(([key, value]) => [
        key,
        attributeToInput(value),
      ]),
    ),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      options: { ...variant.options },
      sku: variant.sku,
      price: amountToInput(variant.price, currency),
      sale_price: amountToInput(variant.sale_price, currency),
      stock: String(variant.stock),
      is_active: variant.is_active,
    })),
    bundle_items: bundleToFormItems(product),
  };
}

/** Attribute values to send: only the category's keys, empties dropped, numbers as numbers. */
export function cleanAttributes(
  values: Readonly<Record<string, unknown>>,
  definitions: readonly CategoryAttribute[],
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const def of definitions) {
    const value = values[def.key];
    if (isEmptyValue(value)) continue;
    if (def.type === "number") cleaned[def.key] = Number(String(value).trim());
    else if (def.type === "text") cleaned[def.key] = String(value).trim();
    else cleaned[def.key] = value;
  }
  return cleaned;
}

/** Variant options to send: the category's keys only; colors carry an uppercase `<key>_hex`. */
export function cleanOptions(
  options: Readonly<Record<string, string>>,
  definitions: readonly CategoryVariantOption[],
): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const def of definitions) {
    cleaned[def.key] = (options[def.key] ?? "").trim();
    if (def.type === "color")
      cleaned[`${def.key}_hex`] = (
        options[`${def.key}_hex`] ?? ""
      ).toUpperCase();
  }
  return cleaned;
}

function optionalText(value: string): string | undefined {
  const text = value.trim();
  return text ? text : undefined;
}

function variantBody(
  variant: VariantFormValues,
  definitions: readonly CategoryVariantOption[],
  index: number,
): VariantCreateBody {
  return {
    options: cleanOptions(variant.options, definitions),
    sku: optionalText(variant.sku),
    price: variant.price.trim(),
    sale_price: optionalText(variant.sale_price),
    stock: Number(variant.stock.trim() || "0"),
    is_active: variant.is_active,
    sort_order: index,
  };
}

/** POST /admin/products. `is_active` is left out: the backend always creates inactive. */
export function buildCreatePayload(
  values: ProductFormValues,
  definitions: Definitions,
): ProductCreateBody {
  const body: ProductCreateBody = {
    type: values.type,
    currency: values.currency,
    name: values.name.trim(),
    description: optionalText(values.description) ?? null,
    category_id: Number(values.category_id),
    brand_id: values.brand_id ? Number(values.brand_id) : null,
    sku: optionalText(values.sku),
    slug: optionalText(values.slug),
    attributes: cleanAttributes(values.attributes, definitions.attributes),
    is_new: values.is_new,
    is_active: false,
  };
  if (values.type === "variable") {
    body.variants = values.variants.map((variant, index) =>
      variantBody(variant, definitions.options, index),
    );
  } else {
    body.price = values.price.trim();
    body.sale_price = optionalText(values.sale_price);
    if (values.type === "simple")
      body.stock = Number(values.stock.trim() || "0");
    if (values.type === "bundle")
      body.bundle_items = buildBundleItems(values.bundle_items);
  }
  return body;
}

/**
 * PATCH /admin/products/{id}. Stock is never sent (it changes through stock-adjust), and a
 * variable product has no price of its own. `attributes` replaces the whole object, so it
 * is always sent. `sku`/`slug` are omitted when empty (an explicit null would regenerate them).
 */
export function buildUpdatePayload(
  values: ProductFormValues,
  definitions: Definitions,
  initialActive: boolean,
): ProductUpdateBody {
  const body: ProductUpdateBody = {
    currency: values.currency,
    name: values.name.trim(),
    description: optionalText(values.description) ?? null,
    category_id: Number(values.category_id),
    brand_id: values.brand_id ? Number(values.brand_id) : null,
    sku: optionalText(values.sku),
    slug: optionalText(values.slug),
    attributes: cleanAttributes(values.attributes, definitions.attributes),
    is_new: values.is_new,
  };
  if (values.type !== "variable") {
    body.price = values.price.trim();
    body.sale_price = optionalText(values.sale_price) ?? null;
  }
  if (values.is_active !== initialActive) body.is_active = values.is_active;
  return body;
}

export type VariantDiff = {
  remove: number[];
  patch: { id: number; body: VariantUpdateBody }[];
  add: VariantCreateBody[];
};

function sameOptions(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? "") === (b[key] ?? ""));
}

function sameAmount(a: string | null, b: string): boolean {
  return (normalizeAmount(a ?? "") ?? "") === (normalizeAmount(b) ?? "");
}

/** What to call on an existing variable product: delete, patch (only changed fields) and add. */
export function diffVariants(
  initial: readonly AdminVariant[],
  values: readonly VariantFormValues[],
  definitions: readonly CategoryVariantOption[],
): VariantDiff {
  const diff: VariantDiff = { remove: [], patch: [], add: [] };
  const kept = new Set<number>();
  values.forEach((variant, index) => {
    const before =
      variant.id === undefined
        ? undefined
        : initial.find((item) => item.id === variant.id);
    if (!before) {
      diff.add.push(variantBody(variant, definitions, index));
      return;
    }
    kept.add(before.id);
    const body: VariantUpdateBody = {};
    const options = cleanOptions(variant.options, definitions);
    if (!sameOptions(options, before.options)) body.options = options;
    const sku = variant.sku.trim();
    if (sku && sku !== before.sku) body.sku = sku;
    if (!sameAmount(before.price, variant.price))
      body.price = variant.price.trim();
    if (!sameAmount(before.sale_price, variant.sale_price))
      body.sale_price = optionalText(variant.sale_price) ?? null;
    if (variant.is_active !== before.is_active)
      body.is_active = variant.is_active;
    if (index !== before.sort_order) body.sort_order = index;
    if (Object.keys(body).length > 0) diff.patch.push({ id: before.id, body });
  });
  diff.remove = initial
    .filter((item) => !kept.has(item.id))
    .map((item) => item.id);
  return diff;
}
