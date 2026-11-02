import type { ReactNode } from "react";
import { Link } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderStats, type OrderStatus } from "@/features/orders";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import { formatRate } from "../format";
import { ordersByStatus } from "../links";

type CardProps = {
  label: string;
  to: string;
  testId: string;
  children: ReactNode;
};

function StatCard({ label, to, testId, children }: CardProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-brand"
    >
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums">
        {children}
      </span>
    </Link>
  );
}

const COUNTS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: m.dashboard.stats.pending },
  { status: "preparing", label: m.dashboard.stats.preparing },
  { status: "shipped", label: m.dashboard.stats.shipped },
];

/** Per-currency amounts, one line each: currencies are never added together. */
function PerCurrency({
  rows,
}: {
  rows: readonly { currency: string; amount: string }[];
}) {
  if (rows.length === 0)
    return (
      <span className="text-sm font-normal text-ink-muted">
        {m.dashboard.stats.noRevenue}
      </span>
    );
  return (
    <span className="flex flex-col text-xl">
      {rows.map((row) => (
        <Money key={row.currency} {...row} />
      ))}
    </span>
  );
}

/** Key numbers from the single `GET /admin/orders/stats` call; each card opens the matching orders list. */
export function StatCards() {
  const stats = useOrderStats();
  const t = m.dashboard;

  if (stats.isPending)
    return (
      <div
        data-testid="stat-cards-loading"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  if (stats.isError)
    return (
      <ErrorState message={errorMessage(stats.error)}>
        <Button variant="outline" onClick={() => void stats.refetch()}>
          {m.common.retry}
        </Button>
      </ErrorState>
    );

  const data = stats.data;
  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="stat-cards"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {COUNTS.map(({ status, label }) => (
          <StatCard
            key={status}
            label={label}
            to={ordersByStatus(status)}
            testId={`stat-${status}`}
          >
            {data.counts[status] ?? 0}
          </StatCard>
        ))}
        <StatCard
          label={t.stats.revenue}
          to={ordersByStatus("delivered")}
          testId="stat-revenue"
        >
          <PerCurrency rows={data.delivered_revenue} />
        </StatCard>
        <StatCard
          label={t.stats.average}
          to={ordersByStatus("delivered")}
          testId="stat-average"
        >
          <PerCurrency rows={data.average_order_value} />
        </StatCard>
        <StatCard
          label={t.stats.cancelledRate}
          to={ordersByStatus("cancelled")}
          testId="stat-cancelled-rate"
        >
          <bdi dir="ltr">{formatRate(data.cancelled_rate)}</bdi>
        </StatCard>
      </div>
      <p className="text-xs text-ink-muted">{t.allTimeNote}</p>
    </div>
  );
}
