import { MapPinIcon } from "lucide-react";

import { m } from "@/messages";

import { describeAddress } from "../address";
import { useGovernorates } from "../api";
import type { OrderDetail } from "../types";

/** The address exactly as stored on the order, with the backend's `map_url` when it has coordinates. */
export function AddressCard({ order }: { order: OrderDetail }) {
  const governorates = useGovernorates();
  const t = m.orders.detail;
  const names = new Map((governorates.data ?? []).map((g) => [g.code, g.name]));
  const view = describeAddress(
    order.shipping_address,
    (code) => names.get(code) ?? code,
  );

  if (order.shipping_address === null)
    return <p className="text-sm">{t.pickup}</p>;
  if (!view) return <p className="text-sm text-ink-muted">{t.noAddress}</p>;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {view.lines.map((line, index) => (
        <span key={index} className={index === 0 ? "font-medium" : undefined}>
          {line}
        </span>
      ))}
      {view.notes ? (
        <span className="text-ink-muted">
          {t.addressNotes}: {view.notes}
        </span>
      ) : null}
      {order.map_url ? (
        <a
          href={order.map_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex w-fit items-center gap-1 text-brand hover:underline"
        >
          <MapPinIcon className="size-4" aria-hidden />
          {t.openMap}
        </a>
      ) : null}
    </div>
  );
}
