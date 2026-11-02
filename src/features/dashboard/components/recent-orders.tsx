import { Link } from "react-router";

import { Money } from "@/components/shared/money";
import { StatusBadge, totalLines } from "@/features/orders";
import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

import { useRecentOrders } from "../api";
import { Widget } from "./widget";

/** The newest orders (own small call), each opening its detail page. Totals stay per currency. */
export function RecentOrders() {
  const query = useRecentOrders();
  const t = m.dashboard.recentOrders;
  const rows = query.data?.items ?? [];
  return (
    <Widget
      title={t.title}
      testId="recent-orders"
      query={query}
      viewAll="/orders"
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">{t.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
            >
              <div className="flex flex-col">
                <Link
                  to={`/orders/${order.id}`}
                  className="inline-flex font-medium tabular-nums hover:text-brand max-md:min-h-11 max-md:items-center"
                >
                  #{order.id}
                </Link>
                <span className="text-sm">{order.customer_name}</span>
                <bdi
                  dir="ltr"
                  className="text-start text-xs text-ink-muted tabular-nums"
                >
                  {formatDateTime(order.created_at)}
                </bdi>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={order.status} label={order.status_label} />
                {totalLines(order.totals).map((line) => (
                  <Money key={line.currency} {...line} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
