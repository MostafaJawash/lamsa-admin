import { Money } from "@/components/shared/money";
import { m } from "@/messages";

import { hasDiscount, sortedTotals } from "../totals";
import type { OrderTotal } from "../types";

type Props = {
  totals: readonly OrderTotal[];
  /** True when the delivery fee is paid straight to the carrier (the fee row is then 0). */
  carrierPaid: boolean;
};

/** One block per currency with the amounts exactly as the backend stored them; never summed across currencies. */
export function OrderTotals({ totals, carrierPaid }: Props) {
  const t = m.orders.detail;
  return (
    <div className="flex flex-col gap-4">
      {sortedTotals(totals).map((row) => (
        <dl
          key={row.currency}
          data-currency={row.currency}
          className="flex flex-col gap-1.5 rounded-lg border border-line p-3 text-sm"
        >
          <div className="flex justify-between">
            <dt className="text-ink-muted">{t.subtotal}</dt>
            <dd>
              <Money amount={row.subtotal} currency={row.currency} />
            </dd>
          </div>
          {hasDiscount(row) ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t.discount}</dt>
              <dd>
                <Money amount={row.discount} currency={row.currency} />
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-ink-muted">{t.shippingFee}</dt>
            <dd>
              {carrierPaid && Number(row.shipping_fee) === 0 ? (
                "—"
              ) : (
                <Money amount={row.shipping_fee} currency={row.currency} />
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold">
            <dt>{t.total}</dt>
            <dd>
              <Money amount={row.total} currency={row.currency} />
            </dd>
          </div>
        </dl>
      ))}
    </div>
  );
}
