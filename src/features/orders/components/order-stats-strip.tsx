import { cn } from "@/lib/utils";
import { m } from "@/messages";

import { useOrderStats } from "../api";
import type { ListParams } from "../list-filters";
import type { OrderStatus } from "../types";

const TILES: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: m.orders.stats.pending },
  { status: "preparing", label: m.orders.stats.preparing },
  { status: "shipped", label: m.orders.stats.shipped },
];

type Props = {
  params: ListParams;
  /** Clicking a tile filters the list to that status. */
  onSelect: (status: OrderStatus | "all") => void;
};

/**
 * At-a-glance counters from the existing `GET /admin/orders/stats` (counts per status, all
 * time). Hidden while loading or if the call fails: the list works without it.
 */
export function OrderStatsStrip({ params, onSelect }: Props) {
  const stats = useOrderStats();
  if (!stats.data) return null;
  return (
    <div
      role="group"
      aria-label={m.orders.stats.title}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {TILES.map(({ status, label }) => {
        const active = params.status === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? "all" : status)}
            className={cn(
              "flex items-baseline justify-between rounded-xl border bg-surface px-4 py-3 text-start transition-colors hover:border-brand",
              active ? "border-brand bg-brand-soft" : "border-line",
            )}
          >
            <span className="text-sm text-ink-muted">{label}</span>
            <span className="font-display text-2xl font-bold tabular-nums">
              {stats.data.counts[status] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
