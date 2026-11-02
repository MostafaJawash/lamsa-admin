import { EyeIcon } from "lucide-react";
import { Link } from "react-router";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

import { accountTypeLabel } from "../labels";
import type { Customer } from "../types";

type Props = {
  rows: readonly Customer[];
  loading: boolean;
  emptyMessage: string;
};

/** The customers list. The order count comes with each row: no per-row calls. */
export function CustomersTable({ rows, loading, emptyMessage }: Props) {
  const t = m.customers;
  const columns: Column<Customer>[] = [
    {
      key: "name",
      mobile: "title",
      header: t.columns.name,
      cell: (customer) => (
        <Link
          to={`/customers/${customer.id}`}
          className="font-medium hover:text-brand"
        >
          {customer.name}
        </Link>
      ),
    },
    {
      key: "phone",
      header: t.columns.phone,
      cell: (customer) => (
        <bdi dir="ltr" className="text-start text-sm">
          {customer.phone}
        </bdi>
      ),
    },
    {
      key: "email",
      header: t.columns.email,
      cell: (customer) =>
        customer.email ? (
          <bdi dir="ltr" className="text-start text-sm">
            {customer.email}
          </bdi>
        ) : (
          t.noEmail
        ),
    },
    {
      key: "registered",
      header: t.columns.registered,
      cell: (customer) => (
        <bdi dir="ltr" className="text-sm tabular-nums">
          {formatDateTime(customer.created_at)}
        </bdi>
      ),
    },
    {
      key: "orders",
      header: t.columns.orders,
      cell: (customer) => (
        <span className="tabular-nums">{customer.orders_count}</span>
      ),
    },
    {
      key: "account",
      header: t.columns.account,
      cell: (customer) => (
        <Badge variant="outline">
          {accountTypeLabel(customer.auth_provider)}
        </Badge>
      ),
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (customer) =>
        customer.is_active ? (
          <Badge>{t.status.active}</Badge>
        ) : (
          <Badge variant="secondary">{t.status.inactive}</Badge>
        ),
    },
    {
      key: "actions",
      mobile: "actions",
      header: t.columns.actions,
      className: "w-16",
      cell: (customer) => (
        <Button asChild variant="ghost" size="icon">
          <Link
            to={`/customers/${customer.id}`}
            aria-label={`${t.view}: ${customer.name}`}
          >
            <EyeIcon />
          </Link>
        </Button>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(customer) => customer.id}
      loading={loading}
      emptyTitle={t.empty}
      emptyMessage={emptyMessage}
    />
  );
}
