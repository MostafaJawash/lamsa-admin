import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/client";

/** Rows each list widget shows; the endpoints are asked for exactly this many. */
export const WIDGET_SIZE = 5;

export function fetchLowStock() {
  // No `threshold`: the backend then uses the store's own low_stock_threshold setting.
  return unwrap(
    api.GET("/admin/products/low-stock", {
      params: { query: { page: 1, page_size: WIDGET_SIZE } },
    }),
  );
}

export function fetchRecentOrders() {
  return unwrap(
    api.GET("/admin/orders", {
      params: {
        query: { page: 1, page_size: WIDGET_SIZE, sort: "newest" },
      },
    }),
  );
}

// Keys sit under ["products"] / ["orders", "list"] so stock adjustments and order changes
// elsewhere in the app refresh these widgets too.
export function useLowStock() {
  return useQuery({
    queryKey: ["products", "low-stock", WIDGET_SIZE],
    queryFn: fetchLowStock,
    staleTime: 30_000,
  });
}

export function useRecentOrders() {
  return useQuery({
    queryKey: ["orders", "list", "recent", WIDGET_SIZE],
    queryFn: fetchRecentOrders,
    staleTime: 30_000,
  });
}
