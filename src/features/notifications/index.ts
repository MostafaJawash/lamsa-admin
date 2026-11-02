/**
 * features/notifications (الإشعارات): admin campaigns as the backend really offers them.
 *
 * The real capability (see README): the backend CAN send. `POST /admin/notifications` creates
 * a campaign for ALL customers (marketing) or ONE customer (message), sent immediately or
 * scheduled (1 minute to 90 days ahead), with an optional catalog link. Real pushes go to
 * real devices when the backend runs with PUSH_BACKEND=firebase, and a push cannot be recalled.
 * The backend has no recipient count, no confirmation and no idempotency key, so the safeguards
 * live here: an exact preview, a typed phrase for broadcasts, a 30 s client-side cooldown after
 * a broadcast, a prominent warning, and the test push to the admin's own devices.
 * There are no segments: only "all" and "one customer".
 */
export {
  BroadcastCooldownError,
  useNotification,
  useNotifications,
  type AdminNotification,
} from "./api";
export {
  BROADCAST_PHRASE,
  SCHEDULE_MAX_MS,
  SCHEDULE_MIN_MS,
  audienceText,
  buildCreateBody,
  deliverySummary,
  isBroadcast,
  isBroadcastConfirmed,
  isScheduleInRange,
  type ComposeDraft,
} from "./campaign";
export { ComposeForm } from "./components/compose-form";
export { NotificationDetail } from "./components/notification-detail";
export { NotificationFilters } from "./components/notification-filters";
export { NotificationsTable } from "./components/notifications-table";
export {
  COOLDOWN_MS,
  cooldownRemainingMs,
  resetBroadcastCooldown,
  startBroadcastCooldown,
} from "./cooldown";
export {
  DEFAULT_PARAMS,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  type ListParams,
} from "./list-filters";
