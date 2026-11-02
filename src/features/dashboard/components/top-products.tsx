import { Link } from "react-router";

import { useOrderStats } from "@/features/orders";
import { m } from "@/messages";

import { productEdit } from "../links";
import { Widget } from "./widget";

/** Best sellers straight from `top_products` of the stats call (delivered orders only). */
export function TopProducts() {
  const stats = useOrderStats();
  const t = m.dashboard.topProducts;
  const rows = stats.data?.top_products ?? [];
  return (
    <Widget title={t.title} testId="top-products" query={stats}>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">{t.empty}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {rows.map((row, index) => (
            <li
              key={`${row.product_id ?? "x"}-${index}`}
              className="flex items-center justify-between gap-2 py-2"
            >
              {row.product_id === null ? (
                <span>{row.name}</span>
              ) : (
                <Link
                  to={productEdit(row.product_id)}
                  className="hover:text-brand"
                >
                  {row.name}
                </Link>
              )}
              <span className="text-sm whitespace-nowrap text-ink-muted tabular-nums">
                {row.quantity} {t.quantity}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Widget>
  );
}
