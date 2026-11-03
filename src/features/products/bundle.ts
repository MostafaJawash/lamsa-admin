import { ApiError, errorMessage } from "@/lib/errors";
import { multiplyAmount, subtractAmounts, sumByCurrency } from "@/lib/money";
import { m } from "@/messages";

import type { AdminProduct } from "./types";

/** The backend's limits for `PUT /admin/products/{id}/bundle-items` (BundleItemIn / BundleItemsIn). */
export const BUNDLE_LIMITS = { maxItems: 50, minQuantity: 1, maxQuantity: 99 };

/** One line of the bundle in the form. `quantity` is the text of the input. */
export type BundleItemValue = {
  product_id: number;
  variant_id: number | null;
  quantity: string;
  /** Display only: the name and variant label the line was added with. */
  name: string;
  variant_label: string | null;
};

export type BundleItemBody = {
  product_id: number;
  variant_id: number | null;
  quantity: number;
};

/** Product + variant: the pair the backend refuses to see twice in one bundle. */
export function bundleKey(item: {
  product_id: number;
  variant_id: number | null;
}): string {
  return `${item.product_id}:${item.variant_id ?? ""}`;
}

export function hasBundleItem(
  items: readonly { product_id: number; variant_id: number | null }[],
  candidate: { product_id: number; variant_id: number | null },
): boolean {
  const key = bundleKey(candidate);
  return items.some((item) => bundleKey(item) === key);
}

/** Indexes of lines that repeat an earlier product+variant. */
export function duplicateIndexes(
  items: readonly { product_id: number; variant_id: number | null }[],
): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  items.forEach((item, index) => {
    const key = bundleKey(item);
    if (seen.has(key)) duplicates.push(index);
    seen.add(key);
  });
  return duplicates;
}

/** "3" -> 3; null unless it is a whole number from 1 to 99. */
export function parseQuantity(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const quantity = Number(value);
  return quantity >= BUNDLE_LIMITS.minQuantity &&
    quantity <= BUNDLE_LIMITS.maxQuantity
    ? quantity
    : null;
}

/** The PUT body's items. Lines with an invalid quantity are the schema's job to catch first. */
export function buildBundleItems(
  items: readonly BundleItemValue[],
): BundleItemBody[] {
  return items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    quantity: parseQuantity(item.quantity) ?? 1,
  }));
}

/** Form lines of a loaded bundle (`bundle_items` of the detail response). */
export function bundleToFormItems(product: AdminProduct): BundleItemValue[] {
  return product.bundle_items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    quantity: String(item.quantity),
    name: item.product_name,
    variant_label: item.variant_label,
  }));
}

/** True when the list differs from what the backend has (order matters: it is stored by id). */
export function bundleItemsChanged(
  initial: readonly BundleItemBody[],
  current: readonly BundleItemBody[],
): boolean {
  return (
    initial.length !== current.length ||
    initial.some((item, i) => {
      const other = current[i];
      return (
        !other ||
        item.product_id !== other.product_id ||
        (item.variant_id ?? null) !== (other.variant_id ?? null) ||
        item.quantity !== other.quantity
      );
    })
  );
}

/** "أحمر، كبير" from a variant's option values (colors' `*_hex` helper keys are skipped). */
export function variantLabel(
  options: Readonly<Record<string, string>>,
): string {
  return Object.entries(options)
    .filter(([key, value]) => !key.endsWith("_hex") && value)
    .map(([, value]) => value)
    .join("، ");
}

export type PricedLine = {
  /** Current price of one unit of the component, or null while it is not known. */
  unitPrice: string | null;
  currency: string | null;
  quantity: number;
};

/**
 * Sum of the components' own prices (price × quantity) in the bundle's currency.
 * Lines of another currency or with an unknown price are left out and reported in `skipped`:
 * currencies are never mixed.
 */
export function bundleTotal(
  lines: readonly PricedLine[],
  currency: string,
): { amount: string; skipped: number } {
  let skipped = 0;
  const parts: { amount: string; currency: string }[] = [];
  for (const line of lines) {
    const amount =
      line.unitPrice !== null && line.currency === currency
        ? multiplyAmount(line.unitPrice, line.quantity)
        : null;
    if (amount === null) skipped++;
    else parts.push({ amount, currency });
  }
  const [total] = sumByCurrency(parts);
  return { amount: total?.amount ?? "0.00", skipped };
}

/** Components' total minus the bundle's price: positive = the bundle is a discount. */
export function bundleSaving(
  total: string,
  bundlePrice: string,
): string | null {
  return subtractAmounts(total, bundlePrice);
}

/** The bundle's own current price from the form's text fields (sale price when valid and set). */
export function effectiveBundlePrice(
  price: string,
  sale: string,
): string | null {
  const text = (sale.trim() || price.trim()).trim();
  return /^\d+(\.\d{1,2})?$/.test(text) ? text : null;
}

/** Current price of one unit of a component, from its detail response. */
export function componentUnitPrice(
  product: AdminProduct,
  variantId: number | null,
): string | null {
  if (product.type === "variable") {
    const variant = product.variants.find((v) => v.id === variantId);
    return variant ? variant.current_price : null;
  }
  return product.price_from;
}

const REASONS: readonly [needle: string, message: () => string][] = [
  ["duplicate", () => m.products.bundle.errors.duplicate],
  ["not found", () => m.products.bundle.errors.notFound],
  ["contain itself", () => m.products.bundle.errors.self],
  ["another bundle", () => m.products.bundle.errors.nested],
  ["variant_id is required", () => m.products.bundle.errors.variantRequired],
  ["does not belong", () => m.products.bundle.errors.variantForeign],
  ["no variants", () => m.products.bundle.errors.noVariants],
];

/**
 * A bundle-items error that names a line: `INVALID_BUNDLE_ITEM {index, reason}` or
 * `BUNDLE_CURRENCY_MISMATCH {index, ...}`, with its Arabic text. Anything else gives null.
 */
export function bundleRowError(
  error: unknown,
): { index: number; message: string } | null {
  if (!(error instanceof ApiError)) return null;
  const details = error.details as { index?: unknown; reason?: unknown } | null;
  if (!details || typeof details.index !== "number") return null;
  if (error.code === "BUNDLE_CURRENCY_MISMATCH")
    return { index: details.index, message: m.products.bundle.errors.currency };
  if (error.code !== "INVALID_BUNDLE_ITEM") return null;
  const reason = typeof details.reason === "string" ? details.reason : "";
  const known = REASONS.find(([needle]) => reason.includes(needle));
  return {
    index: details.index,
    message: known ? known[1]() : errorMessage(error),
  };
}
