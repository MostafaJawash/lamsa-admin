import { EyeIcon } from "lucide-react";
import { Link } from "react-router";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

import { totalLines } from "../totals";
import type { OrderSummary } from "../types";
import { StatusBadge } from "./status-badge";

type Props = {
  rows: readonly OrderSummary[];
  loading: boolean;
  emptyMessage: string;
  /** Hide the customer column (the customer's own page lists only their orders). */
  hideCustomer?: boolean;
};

/** The orders list table. Each total is shown per currency and never added across currencies. */
export function OrdersTable({
  rows,
  loading,
  emptyMessage,
  hideCustomer = false,
}: Props) {
  const t = m.orders;
  const columns: Column<OrderSummary>[] = [
    {
      key: "number",
      mobile: "title",
      header: t.columns.number,
      cell: (order) => (
        <Link
          to={`/orders/${order.id}`}
          className="font-medium tabular-nums hover:text-brand"
        >
          #{order.id}
        </Link>
      ),
    },
    {
      key: "customer",
      header: t.columns.customer,
      cell: (order) => (
        <div className="flex flex-col">
          <span>{order.customer_name}</span>
          <bdi dir="ltr" className="text-start text-xs text-ink-muted">
            {order.customer_phone}
          </bdi>
        </div>
      ),
    },
    {
      key: "date",
      header: t.columns.date,
      cell: (order) => (
        <bdi dir="ltr" className="text-sm tabular-nums">
          {formatDateTime(order.created_at)}
        </bdi>
      ),
    },
    {
      key: "items",
      header: t.columns.items,
      cell: (order) => (
        <span className="tabular-nums">
          {order.items_count} {t.itemsCount}
        </span>
      ),
    },
    {
      key: "total",
      header: t.columns.total,
      cell: (order) => (
        <div className="flex flex-col gap-0.5">
          {totalLines(order.totals).map((line) => (
            <Money key={line.currency} {...line} />
          ))}
        </div>
      ),
    },
    {
      key: "delivery",
      header: t.columns.delivery,
      cell: (order) => order.delivery_method_name,
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (order) => (
        <StatusBadge status={order.status} label={order.status_label} />
      ),
    },
    {
      key: "actions",
      mobile: "actions",
      header: t.columns.actions,
      className: "w-16",
      cell: (order) => (
        <Button asChild variant="ghost" size="icon">
          <Link
            to={`/orders/${order.id}`}
            aria-label={`${t.view}: #${order.id}`}
          >
            <EyeIcon />
          </Link>
        </Button>
      ),
    },
  ];
  return (
    <DataTable
      columns={
        hideCustomer ? columns.filter((c) => c.key !== "customer") : columns
      }
      rows={rows}
      rowKey={(order) => order.id}
      loading={loading}
      emptyTitle={t.empty}
      emptyMessage={emptyMessage}
    />
  );
}
