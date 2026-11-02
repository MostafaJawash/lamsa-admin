import type { MoneyValue } from "@/lib/money";

import type { OrderTotal } from "./types";

const ORDER = ["SYP", "USD"];

function rank(code: string): number {
  const index = ORDER.indexOf(code);
  return index === -1 ? ORDER.length : index;
}

/**
 * The order's grand totals, one per currency, exactly as the backend computed them
 * (SYP, then USD, then legacy codes). Nothing is added, converted or recomputed.
 */
export function totalLines(totals: readonly OrderTotal[]): MoneyValue[] {
  return [...totals]
    .sort(
      (a, b) =>
        rank(a.currency) - rank(b.currency) ||
        a.currency.localeCompare(b.currency),
    )
    .map((row) => ({ currency: row.currency, amount: row.total }));
}

/** Per-currency blocks in display order. */
export function sortedTotals(totals: readonly OrderTotal[]): OrderTotal[] {
  return [...totals].sort(
    (a, b) =>
      rank(a.currency) - rank(b.currency) ||
      a.currency.localeCompare(b.currency),
  );
}

/** Discounts are always 0 today; show the row only when it is not. */
export function hasDiscount(total: OrderTotal): boolean {
  return Number(total.discount) > 0;
}
