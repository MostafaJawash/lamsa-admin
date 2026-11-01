import { formatMoney, type MoneyValue } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneyProps = MoneyValue & { className?: string };

/**
 * One backend amount with its currency ("150,000 ل.س"). Always pass the currency the
 * backend returned with the amount; never add two Money values together (use
 * `sumByCurrency` from src/lib/money.ts, which keeps one bucket per currency).
 */
export function Money({ amount, currency, className }: MoneyProps) {
  return (
    <span
      dir="ltr"
      className={cn(
        "whitespace-nowrap tabular-nums [unicode-bidi:isolate]",
        className,
      )}
    >
      {formatMoney(amount, currency)}
    </span>
  );
}
