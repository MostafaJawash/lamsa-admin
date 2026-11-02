import { m } from "@/messages";

import type { OrderStatus } from "./types";

/**
 * The backend's workflow (lamsa-backend `app/modules/orders/workflow.py`):
 *   delivery: pending -> preparing -> shipped -> delivered
 *   pickup:   pending -> preparing -> ready_for_pickup -> delivered   (historical orders only)
 * An admin moves exactly one step forward (`allowed_next_statuses`, which the UI renders
 * as is, never its own guess) or cancels from pending/preparing/shipped/ready_for_pickup.
 * delivered and cancelled are final.
 */
export const STATUSES: readonly OrderStatus[] = [
  "pending",
  "preparing",
  "shipped",
  "ready_for_pickup",
  "delivered",
  "cancelled",
];

export function isOrderStatus(value: string | null): value is OrderStatus {
  return STATUSES.includes(value as OrderStatus);
}

/** The Arabic label for a status (the backend's `status_label` wins where an order is at hand). */
export function statusLabel(status: string): string {
  return m.orderStatus[status] ?? status;
}

export type StatusTone =
  "neutral" | "warn" | "brand" | "gold" | "ok" | "danger";

const TONES: Record<OrderStatus, StatusTone> = {
  pending: "neutral",
  preparing: "warn",
  shipped: "brand",
  ready_for_pickup: "gold",
  delivered: "ok",
  cancelled: "danger",
};

export function statusTone(status: string): StatusTone {
  return TONES[status as OrderStatus] ?? "neutral";
}

/** Soft badge colors from the design tokens (light and dark follow the tokens). */
export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  warn: "bg-warn/15 text-warn",
  brand: "bg-brand-soft text-brand",
  gold: "bg-gold/15 text-gold",
  ok: "bg-ok/15 text-ok",
  danger: "bg-danger/15 text-danger",
};

export type NextAction = { to: OrderStatus; label: string };

/** A pickup order has no shipping address (the backend decides it the same way). */
export function isPickupOrder(order: { shipping_address: unknown }): boolean {
  return order.shipping_address === null;
}

/** One button per status the backend allows next; unknown values are ignored. */
export function nextActions(
  allowed: readonly string[],
  pickup: boolean,
): NextAction[] {
  return allowed.filter(isOrderStatus).flatMap((to) => {
    if (to === "cancelled") return [];
    const label =
      to === "delivered" && pickup
        ? m.orders.next.deliveredPickup
        : m.orders.next[to as Exclude<OrderStatus, "cancelled" | "pending">];
    return label ? [{ to, label }] : [];
  });
}
