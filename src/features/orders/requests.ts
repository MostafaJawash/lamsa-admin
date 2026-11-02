import { api, unwrap } from "@/lib/api/client";

import { PAGE_SIZE, type ListParams } from "./list-filters";
import type { OrderStatus } from "./types";

/** One function per backend call, shared by the hooks. */

export function fetchOrders(params: ListParams) {
  return unwrap(
    api.GET("/admin/orders", {
      params: {
        query: {
          page: params.page,
          page_size: PAGE_SIZE,
          q: params.q.trim() || undefined,
          status: params.status === "all" ? undefined : params.status,
          delivery_method:
            params.delivery === "all" ? undefined : params.delivery,
          date_from: params.from || undefined,
          date_to: params.to || undefined,
          sort: params.sort,
        },
      },
    }),
  );
}

export function fetchOrder(id: number) {
  return unwrap(
    api.GET("/admin/orders/{order_id}", {
      params: { path: { order_id: id } },
    }),
  );
}

export function fetchOrderStats() {
  return unwrap(api.GET("/admin/orders/stats"));
}

export function changeOrderStatus(id: number, to: OrderStatus, note?: string) {
  return unwrap(
    api.POST("/admin/orders/{order_id}/status", {
      params: { path: { order_id: id } },
      body: { to_status: to, note: note || null },
    }),
  );
}

export function cancelOrder(id: number, reason: string, restoreStock: boolean) {
  return unwrap(
    api.POST("/admin/orders/{order_id}/cancel", {
      params: { path: { order_id: id } },
      body: { reason, restore_stock: restoreStock },
    }),
  );
}

export function fetchDeliveryMethods() {
  return unwrap(api.GET("/admin/delivery-methods"));
}

export function fetchGovernorates() {
  return unwrap(api.GET("/governorates"));
}
