import { amountRange, formatMoney, type MoneyValue } from "@/lib/money";
import { m } from "@/messages";

import type { AdminVariant, ProductListItem } from "./types";

/**
 * The price cell of a list row. The list endpoint only returns `price_from` (the lowest
 * current price), so a variable product shows "من X"; its full range is on the edit page.
 */
export function listPrice(item: ProductListItem): {
  from: boolean;
  money: MoneyValue;
} {
  return {
    from: item.type === "variable",
    money: { amount: item.price_from, currency: item.currency },
  };
}

/** Plain-text price range of amounts in one currency: "X" when equal, else "من X إلى Y". */
export function priceRangeText(
  amounts: readonly string[],
  currency: string,
): string | null {
  const range = amountRange(amounts);
  if (!range) return null;
  if (range.min === range.max) return formatMoney(range.min, currency);
  return `${m.products.from} ${formatMoney(range.min, currency)} ${m.products.to} ${formatMoney(range.max, currency)}`;
}

/** Range of the variants' current prices (sale price when on sale), in the product's currency. */
export function variantPriceRange(
  variants: readonly Pick<AdminVariant, "current_price">[],
  currency: string,
): string | null {
  return priceRangeText(
    variants.map((variant) => variant.current_price),
    currency,
  );
}

/** Stock cell: simple = its stock, variable = the sum of its variants (marked "multiple"), bundle = none. */
export function stockCell(item: ProductListItem): {
  value: number | null;
  multiple: boolean;
} {
  return { value: item.stock ?? null, multiple: item.type === "variable" };
}
