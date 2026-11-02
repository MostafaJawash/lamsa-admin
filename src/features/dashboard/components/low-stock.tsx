import { Link } from "react-router";

import { m } from "@/messages";

import { WIDGET_SIZE, useLowStock } from "../api";
import { LOW_STOCK_ALL, productEdit } from "../links";
import { Widget } from "./widget";

/** The lowest-stock active products/variants (store threshold), each opening its edit page. */
export function LowStock() {
  const query = useLowStock();
  const t = m.dashboard.lowStock;
  const data = query.data;
  const rows = data?.items ?? [];
  return (
    <Widget
      title={t.title}
      testId="low-stock"
      query={query}
      viewAll={data && data.total > WIDGET_SIZE ? LOW_STOCK_ALL : undefined}
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">{t.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li key={`${row.product_id}-${row.variant_id ?? 0}`}>
              <Link
                to={productEdit(row.product_id)}
                className="flex items-center justify-between gap-2 py-2 hover:text-brand"
              >
                <span className="flex flex-col">
                  <span>{row.product_name}</span>
                  {row.variant_label || row.sku ? (
                    <span className="text-xs text-ink-muted">
                      {row.variant_label}
                      {row.variant_label && row.sku ? " · " : ""}
                      {row.sku ? <bdi dir="ltr">{row.sku}</bdi> : null}
                    </span>
                  ) : null}
                </span>
                <span
                  data-testid="stock-badge"
                  className={
                    row.stock === 0
                      ? "rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-danger tabular-nums"
                      : "rounded-full bg-warn/15 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-warn tabular-nums"
                  }
                >
                  {t.left}: {row.stock}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
