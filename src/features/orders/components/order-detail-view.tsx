import type { ReactNode } from "react";
import { Link } from "react-router";

import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

import { customerHref } from "../address";
import type { OrderDetail } from "../types";
import { AddressCard } from "./address-card";
import { OrderActions } from "./order-actions";
import { OrderItems } from "./order-items";
import { OrderTotals } from "./order-totals";
import { OrderHistory, OrderTimeline } from "./order-timeline";
import { StatusBadge } from "./status-badge";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** The whole order: items and totals on one side, customer/delivery/status on the other. */
export function OrderDetailView({ order }: { order: OrderDetail }) {
  const t = m.orders.detail;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">
          {m.orders.orderNumber} <bdi className="tabular-nums">#{order.id}</bdi>
        </h1>
        <StatusBadge status={order.status} label={order.status_label} />
        <span className="text-sm text-ink-muted">
          {t.placedAt}:{" "}
          <bdi dir="ltr" className="tabular-nums">
            {formatDateTime(order.created_at)}
          </bdi>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card title={t.items}>
            <OrderItems items={order.items} />
          </Card>
          <Card title={t.totals}>
            <OrderTotals
              totals={order.totals}
              carrierPaid={order.delivery.fee_paid_to_carrier}
            />
          </Card>
          {order.customer_notes || order.gift_message ? (
            <Card title={t.customerNotes}>
              <div className="flex flex-col gap-2 text-sm">
                {order.customer_notes ? <p>{order.customer_notes}</p> : null}
                {order.gift_message ? (
                  <p>
                    <span className="font-medium">{t.giftMessage}: </span>
                    {order.gift_message}
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card title={t.actions}>
            <OrderActions order={order} />
          </Card>
          <Card title={t.customer}>
            <div className="flex flex-col gap-0.5 text-sm">
              <Link
                to={customerHref(order.customer.user_id)}
                className="font-medium hover:text-brand"
              >
                {order.customer.name}
              </Link>
              <bdi dir="ltr" className="text-start text-ink-muted">
                {order.customer.phone}
              </bdi>
              <span className="text-ink-muted">
                {t.customerOrders}:{" "}
                <bdi className="tabular-nums">
                  {order.customer.orders_count}
                </bdi>
              </span>
            </div>
          </Card>
          <Card title={t.address}>
            <AddressCard order={order} />
          </Card>
          <Card title={t.delivery}>
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{order.delivery.name}</span>
              {order.delivery.fee_paid_to_carrier ? (
                <span className="text-ink-muted">{t.carrierPaid}</span>
              ) : null}
            </div>
          </Card>
          <Card title={t.payment}>
            <div className="flex flex-col gap-1 text-sm">
              <span>
                {t.paymentMethods[order.payment_method] ?? order.payment_method}
              </span>
              <span className="text-ink-muted">
                {t.paymentStatus[order.payment_status] ?? order.payment_status}
              </span>
            </div>
          </Card>
          <Card title={t.timeline}>
            <OrderTimeline order={order} />
          </Card>
          <Card title={t.history}>
            <OrderHistory order={order} />
          </Card>
        </div>
      </div>
    </div>
  );
}
