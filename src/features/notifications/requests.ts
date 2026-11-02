import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

import { PAGE_SIZE, type ListParams } from "./list-filters";

export type AdminNotification = components["schemas"]["AdminNotificationOut"];
export type NotificationCreateBody =
  components["schemas"]["AdminNotificationCreate"];
export type NotificationUpdateBody =
  components["schemas"]["AdminNotificationUpdate"];
export type PushTestResult = components["schemas"]["PushTestOut"];

export function fetchNotifications(params: ListParams) {
  return unwrap(
    api.GET("/admin/notifications", {
      params: {
        query: {
          page: params.page,
          page_size: PAGE_SIZE,
          status: params.status === "all" ? undefined : params.status,
          audience: params.audience === "all" ? undefined : params.audience,
        },
      },
    }),
  );
}

export function fetchNotification(id: number) {
  return unwrap(
    api.GET("/admin/notifications/{notification_id}", {
      params: { path: { notification_id: id } },
    }),
  );
}

/** THE send call: with no `scheduled_at` the backend queues the push immediately. */
export function createNotification(body: NotificationCreateBody) {
  return unwrap(api.POST("/admin/notifications", { body }));
}

export function updateNotification(id: number, body: NotificationUpdateBody) {
  return unwrap(
    api.PATCH("/admin/notifications/{notification_id}", {
      params: { path: { notification_id: id } },
      body,
    }),
  );
}

export function cancelNotification(id: number) {
  return unwrap(
    api.POST("/admin/notifications/{notification_id}/cancel", {
      params: { path: { notification_id: id } },
    }),
  );
}

/** Sends a scheduled campaign right now (also during quiet hours). */
export function sendNotificationNow(id: number) {
  return unwrap(
    api.POST("/admin/notifications/{notification_id}/send-now", {
      params: { path: { notification_id: id } },
    }),
  );
}

/** Pushes to the calling admin's OWN devices only; no inbox row, nothing in the history. */
export function sendTestPush(body: { title?: string; body?: string }) {
  // The generated type marks the defaulted fields required; omitting them is valid.
  return unwrap(
    api.POST("/admin/notifications/test", {
      body: body as components["schemas"]["PushTestIn"],
    }),
  );
}
