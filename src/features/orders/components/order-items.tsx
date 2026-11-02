import { Link } from "react-router";

import { Money } from "@/components/shared/money";
import { imageProps } from "@/lib/images";
import { m } from "@/messages";

import type { OrderItem } from "../types";

/** A bundle line carries `bundle_contents`, a list of free-form objects; read it defensively. */
function bundleLines(contents: OrderItem["bundle_contents"]): string[] {
  if (!Array.isArray(contents)) return [];
  return contents.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { name, quantity } = entry as { name?: unknown; quantity?: unknown };
    if (typeof name !== "string" || !name) return [];
    return [typeof quantity === "number" ? `${name} × ${quantity}` : name];
  });
}

/** Every line item with its image, variant, quantity and prices in the line's own currency. */
export function OrderItems({ items }: { items: readonly OrderItem[] }) {
  const t = m.orders.detail;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((item, index) => {
        const contents = bundleLines(item.bundle_contents);
        return (
          <li key={index} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            {item.image ? (
              <img
                {...imageProps(item.image, "64px")}
                alt=""
                loading="lazy"
                className="size-16 shrink-0 rounded-md border border-line object-cover"
              />
            ) : (
              <div className="size-16 shrink-0 rounded-md border border-dashed border-line" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {item.product_id !== null ? (
                <Link
                  to={`/products/${item.product_id}/edit`}
                  className="font-medium hover:text-brand"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="font-medium" title={t.productRemoved}>
                  {item.name}
                </span>
              )}
              {item.variant_label ? (
                <span className="text-sm text-ink-muted">
                  {item.variant_label}
                </span>
              ) : null}
              {contents.length > 0 ? (
                <span className="text-xs text-ink-muted">
                  {t.bundleContents}: {contents.join("، ")}
                </span>
              ) : null}
              <span className="text-sm text-ink-muted">
                {t.quantity}:{" "}
                <bdi className="tabular-nums">{item.quantity}</bdi>
                {" × "}
                <Money amount={item.unit_price} currency={item.currency} />
              </span>
            </div>
            <div className="flex flex-col items-end text-end">
              <span className="text-xs text-ink-muted">{t.lineTotal}</span>
              <Money
                amount={item.line_total}
                currency={item.currency}
                className="font-medium"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
