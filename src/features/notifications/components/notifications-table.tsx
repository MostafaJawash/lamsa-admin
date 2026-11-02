import { Link } from "react-router";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

import type { AdminNotification } from "../api";
import { audienceText, deliverySummary } from "../campaign";

type Props = {
  rows: readonly AdminNotification[];
  loading: boolean;
  emptyMessage: string;
};

export function StatusBadge({
  status,
}: {
  status: AdminNotification["status"];
}) {
  const label = m.notifications.status[status];
  if (status === "sent") return <Badge>{label}</Badge>;
  return (
    <Badge variant={status === "cancelled" ? "secondary" : "outline"}>
      {label}
    </Badge>
  );
}

/** The moment that matters for the row: when it went out, else when it will, else when written. */
function rowDate(n: AdminNotification): string {
  return formatDateTime(n.sent_at ?? n.scheduled_at ?? n.created_at);
}

/** History of campaigns, newest first (the backend's order). Each row opens its detail. */
export function NotificationsTable({ rows, loading, emptyMessage }: Props) {
  const t = m.notifications;
  const columns: Column<AdminNotification>[] = [
    {
      key: "date",
      header: t.columns.date,
      className: "w-40",
      cell: (n) => <span className="tabular-nums">{rowDate(n)}</span>,
    },
    {
      key: "message",
      header: t.columns.message,
      cell: (n) => (
        <Link to={`/notifications/${n.id}`} className="flex max-w-md flex-col">
          <span className="truncate font-medium hover:text-brand">
            {n.title}
          </span>
          <span className="truncate text-xs text-ink-muted">{n.body}</span>
        </Link>
      ),
    },
    {
      key: "audience",
      header: t.columns.audience,
      cell: (n) => <span>{audienceText(n)}</span>,
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (n) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={n.status} />
          {n.deferred_by_quiet_hours ? (
            <span className="text-xs text-ink-muted">{t.deferred}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "delivery",
      header: t.columns.delivery,
      cell: (n) => (
        <span className="text-xs tabular-nums">{deliverySummary(n)}</span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(n) => n.id}
      loading={loading}
      emptyTitle={t.empty}
      emptyMessage={emptyMessage}
    />
  );
}
