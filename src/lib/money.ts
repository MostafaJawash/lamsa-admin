/**
 * Money display. The backend sends amounts as strings with two decimals plus a currency,
 * and never converts between currencies. So this module:
 *  - formats from the string, never through floating point;
 *  - never adds two currencies: `sumByCurrency` returns one bucket per currency.
 */

export type Currency = "SYP" | "USD";

/** A backend money value: amount string ("150000.00") and its currency code. */
export type MoneyValue = { amount: string; currency: string };

const AMOUNT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

function group(whole: string): string {
  return whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * "150000.00" + SYP -> "150,000 ل.س"; "8.50" + USD -> "8.5 $". Latin digits, as on the
 * website. Historical EUR keeps its symbol; any other code prints as "amount CODE". A
 * string that is not an amount is returned unchanged.
 */
export function formatMoney(amount: string, currency: string): string {
  const match = AMOUNT.exec(amount.trim());
  if (!match) return amount;
  const [, sign = "", whole = "0", fraction = ""] = match;
  const grouped = `${sign}${group(whole)}`;
  const decimals = fraction.padEnd(2, "0");
  switch (currency) {
    case "SYP":
      return `${grouped} ل.س`;
    case "USD": {
      const trimmed = decimals.replace(/0+$/, "");
      return `${grouped}${trimmed ? `.${trimmed}` : ""} $`;
    }
    case "EUR":
      return `${grouped}.${decimals} €`;
    default:
      return `${amount} ${currency}`.trim();
  }
}

const CURRENCY_ORDER = ["SYP", "USD"];

function toMinor(amount: string): bigint | null {
  const match = AMOUNT.exec(amount.trim());
  if (!match) return null;
  const [, sign = "", whole = "0", fraction = ""] = match;
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign ? -minor : minor;
}

function fromMinor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Totals per currency, in the backend's order (SYP, then USD, then others by code).
 * Values with an unparseable amount are skipped. This is the only allowed way to
 * aggregate money on a page: it can never mix currencies.
 */
export function sumByCurrency(values: readonly MoneyValue[]): MoneyValue[] {
  const buckets = new Map<string, bigint>();
  for (const { amount, currency } of values) {
    const minor = toMinor(amount);
    if (minor === null) continue;
    buckets.set(currency, (buckets.get(currency) ?? 0n) + minor);
  }
  const rank = (code: string) => {
    const index = CURRENCY_ORDER.indexOf(code);
    return index === -1 ? CURRENCY_ORDER.length : index;
  };
  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([currency, minor]) => ({ currency, amount: fromMinor(minor) }));
}

/** Smallest and largest of amounts that share one currency, as amount strings; null when none parse. */
export function amountRange(
  amounts: readonly string[],
): { min: string; max: string } | null {
  let min: bigint | null = null;
  let max: bigint | null = null;
  for (const amount of amounts) {
    const minor = toMinor(amount);
    if (minor === null) continue;
    if (min === null || minor < min) min = minor;
    if (max === null || minor > max) max = minor;
  }
  return min === null || max === null
    ? null
    : { min: fromMinor(min), max: fromMinor(max) };
}

/** True when `a` is strictly lower than `b` (both unparseable or equal give false). */
export function isLowerAmount(a: string, b: string): boolean {
  const x = toMinor(a);
  const y = toMinor(b);
  return x !== null && y !== null && x < y;
}

/** "150000" -> "150000.00", "8.5" -> "8.50"; null when it is not an amount. */
export function normalizeAmount(amount: string): string | null {
  const minor = toMinor(amount);
  return minor === null ? null : fromMinor(minor);
}
