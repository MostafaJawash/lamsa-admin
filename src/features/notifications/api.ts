import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { cooldownRemainingMs, startBroadcastCooldown } from "./cooldown";
import type { ListParams } from "./list-filters";
import {
  cancelNotification,
  createNotification,
  fetchNotification,
  fetchNotifications,
  sendNotificationNow,
  sendTestPush,
  updateNotification,
  type AdminNotification,
  type NotificationCreateBody,
  type NotificationUpdateBody,
} from "./requests";

export type { AdminNotification };

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: ListParams) => ["notifications", "list", params] as const,
  detail: (id: number) => ["notifications", "detail", id] as const,
};

export function useNotifications(params: ListParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => fetchNotifications(params),
    placeholderData: keepPreviousData,
  });
}

const IN_FLIGHT = new Set(["queued", "sending"]);

/** Refreshes itself every 3 s while the campaign is still being sent. */
export function useNotification(id: number | null) {
  return useQuery({
    queryKey: notificationKeys.detail(id ?? 0),
    queryFn: () => fetchNotification(id as number),
    enabled: id !== null,
    refetchInterval: (query) =>
      query.state.data && IN_FLIGHT.has(query.state.data.status) ? 3000 : false,
  });
}

function useInvalidateNotifications() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: notificationKeys.all });
}

/** Thrown instead of sending when a broadcast was accepted less than 30 s ago. */
export class BroadcastCooldownError extends Error {
  constructor() {
    super("BROADCAST_COOLDOWN");
    this.name = "BroadcastCooldownError";
  }
}

let broadcastInFlight = false;

/**
 * Runs a broadcast request behind two synchronous guards that do not depend on React having
 * re-rendered (a mutation's isPending is updated asynchronously, so two quick clicks could
 * both get through a disabled-button check): the cooldown after the last accepted broadcast,
 * and "one broadcast request at a time". The cooldown starts the moment the backend accepts it.
 */
async function guardedBroadcast<T>(request: () => Promise<T>): Promise<T> {
  if (broadcastInFlight || cooldownRemainingMs() > 0)
    throw new BroadcastCooldownError();
  broadcastInFlight = true;
  try {
    const result = await request();
    startBroadcastCooldown();
    return result;
  } finally {
    broadcastInFlight = false;
  }
}

/**
 * Creates a campaign (the call that really sends or schedules it). A broadcast goes through
 * `guardedBroadcast`; a message to one customer does not need it.
 */
export function useCreateNotification() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (body: NotificationCreateBody) =>
      body.audience === "all"
        ? guardedBroadcast(() => createNotification(body))
        : createNotification(body),
    onSuccess: invalidate,
  });
}

export function useUpdateNotification(id: number) {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (body: NotificationUpdateBody) => updateNotification(id, body),
    onSuccess: invalidate,
  });
}

export function useCancelNotification(id: number) {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => cancelNotification(id),
    onSuccess: invalidate,
  });
}

/** Sending a scheduled broadcast now is a broadcast too: same cooldown. */
export function useSendNotificationNow(notification: AdminNotification) {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () =>
      notification.audience === "all"
        ? guardedBroadcast(() => sendNotificationNow(notification.id))
        : sendNotificationNow(notification.id),
    onSuccess: invalidate,
  });
}

/** Test push to the admin's own devices; nothing is stored, so nothing to invalidate. */
export function useTestPush() {
  return useMutation({
    mutationFn: (body: { title?: string; body?: string }) => sendTestPush(body),
  });
}
