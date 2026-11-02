import { fromStoreInput } from "@/lib/dates";
import { m } from "@/messages";

import { toBackendLink, type LinkValue } from "@/features/banners";
import type { Audience } from "./list-filters";
import type { AdminNotification, NotificationCreateBody } from "./requests";

/** The backend's scheduling window: 1 minute to 90 days ahead (`INVALID_SCHEDULE`). */
export const SCHEDULE_MIN_MS = 60_000;
export const SCHEDULE_MAX_MS = 90 * 24 * 60 * 60_000;

/** The exact phrase an admin types before a broadcast goes out. */
export const BROADCAST_PHRASE = m.notifications.send.phrase;

function squash(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** The broadcast stays locked until the typed text equals the phrase (spaces ignored at the ends). */
export function isBroadcastConfirmed(typed: string): boolean {
  return squash(typed) === squash(BROADCAST_PHRASE);
}

/** "جميع العملاء" or the customer's name; a customer without a known name shows their id. */
export function audienceText(n: {
  audience: Audience;
  user_id?: number | null;
  user_name?: string | null;
}): string {
  if (n.audience === "all") return m.notifications.audience.all;
  return n.user_name || (n.user_id != null ? `#${n.user_id}` : "—");
}

/** True when a send reaches every customer: this is the one that needs the typed phrase. */
export function isBroadcast(audience: Audience): boolean {
  return audience === "all";
}

/** Delivery numbers of a campaign: only meaningful once it has been sent. */
export function deliverySummary(
  n: Pick<
    AdminNotification,
    "status" | "recipients_count" | "success_count" | "failure_count"
  >,
): string {
  const t = m.notifications.delivery;
  if (n.status !== "sent") return t.none;
  return `${t.recipients}: ${n.recipients_count} · ${t.success}: ${n.success_count} · ${t.failure}: ${n.failure_count}`;
}

/** Whether a store-time `datetime-local` value is inside the backend's window. */
export function isScheduleInRange(
  local: string,
  now: number = Date.now(),
): boolean {
  const iso = fromStoreInput(local);
  if (!iso) return false;
  const delta = Date.parse(iso) - now;
  return delta >= SCHEDULE_MIN_MS && delta <= SCHEDULE_MAX_MS;
}

export type ComposeDraft = {
  audience: Audience;
  customerId: number | null;
  title: string;
  body: string;
  link: LinkValue;
  /** A store-time `datetime-local` value, or "" to send now. */
  scheduledAt: string;
};

/** The request body of `POST /admin/notifications`; the value-less link types are omitted. */
export function buildCreateBody(draft: ComposeDraft): NotificationCreateBody {
  const link = toBackendLink(draft.link);
  return {
    audience: draft.audience,
    ...(draft.audience === "user" ? { user_id: draft.customerId } : {}),
    title: draft.title.trim(),
    body: draft.body.trim(),
    ...(link.type === "none" ? {} : { link }),
    ...(draft.scheduledAt
      ? { scheduled_at: fromStoreInput(draft.scheduledAt) }
      : {}),
  };
}
