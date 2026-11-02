import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

import { accountTypeLabel, isCustomerAccount } from "../labels";
import type { Customer } from "../types";

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** Name, phone, email, registration, last login, account type, status and order count. */
export function CustomerProfile({ customer }: { customer: Customer }) {
  const t = m.customers.detail;
  return (
    <div className="flex flex-col gap-3">
      {!isCustomerAccount(customer) ? (
        <p
          role="note"
          className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm"
        >
          {t.adminAccount}
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Item label={t.name}>{customer.name}</Item>
        <Item label={t.phone}>
          <bdi dir="ltr">{customer.phone}</bdi>
        </Item>
        <Item label={t.email}>
          {customer.email ? (
            <bdi dir="ltr">{customer.email}</bdi>
          ) : (
            m.customers.noEmail
          )}
        </Item>
        <Item label={t.registered}>
          <bdi dir="ltr" className="tabular-nums">
            {formatDateTime(customer.created_at)}
          </bdi>
        </Item>
        <Item label={t.lastLogin}>
          {customer.last_login_at ? (
            <bdi dir="ltr" className="tabular-nums">
              {formatDateTime(customer.last_login_at)}
            </bdi>
          ) : (
            t.never
          )}
        </Item>
        <Item label={t.account}>
          <Badge variant="outline">
            {accountTypeLabel(customer.auth_provider)}
          </Badge>
        </Item>
        <Item label={t.status}>
          {customer.is_active ? (
            <Badge>{m.customers.status.active}</Badge>
          ) : (
            <Badge variant="secondary">{m.customers.status.inactive}</Badge>
          )}
        </Item>
        <Item label={t.ordersCount}>
          <span className="tabular-nums">{customer.orders_count}</span>
        </Item>
      </dl>
      {customer.must_change_password ? (
        <Badge variant="outline" className="w-fit">
          {t.tempPassword}
        </Badge>
      ) : null}
    </div>
  );
}
