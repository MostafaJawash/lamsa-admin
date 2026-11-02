import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { ListParams } from "./list-filters";
import {
  cancelOrder,
  changeOrderStatus,
  fetchDeliveryMethods,
  fetchGovernorates,
  fetchOrder,
  fetchOrderStats,
  fetchOrders,
} from "./requests";
import type { OrderStatus } from "./types";

export const orderKeys = {
  all: ["orders"] as const,
  list: (params: ListParams) => ["orders", "list", params] as const,
  detail: (id: number) => ["orders", "detail", id] as const,
  stats: ["orders", "stats"] as const,
};

export function useOrders(params: ListParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => fetchOrders(params),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? 0),
    queryFn: () => fetchOrder(id as number),
    enabled: id !== null,
  });
}

/** Counts per status for the strip above the list (one existing endpoint, no new queries). */
export function useOrderStats() {
  return useQuery({
    queryKey: orderKeys.stats,
    queryFn: fetchOrderStats,
    staleTime: 30_000,
  });
}

/** For the delivery filter: the store's delivery methods (courier, province shipping). */
export function useDeliveryMethods() {
  return useQuery({
    queryKey: ["delivery-methods"],
    queryFn: fetchDeliveryMethods,
    staleTime: 5 * 60_000,
  });
}

/** The 14 governorates; orders store only the code. */
export function useGovernorates() {
  return useQuery({
    queryKey: ["governorates"],
    queryFn: fetchGovernorates,
    staleTime: Infinity,
  });
}

/**
 * Both mutations return the whole updated order, so the detail cache is replaced with the
 * server's answer (history, timeline and next steps included); lists and stats refetch.
 */
function useAfterChange(id: number) {
  const client = useQueryClient();
  return (order: unknown) => {
    client.setQueryData(orderKeys.detail(id), order);
    void client.invalidateQueries({ queryKey: ["orders", "list"] });
    void client.invalidateQueries({ queryKey: orderKeys.stats });
  };
}

export function useChangeStatus(id: number) {
  const after = useAfterChange(id);
  return useMutation({
    mutationFn: ({ to, note }: { to: OrderStatus; note?: string }) =>
      changeOrderStatus(id, to, note),
    onSuccess: after,
  });
}

export function useCancelOrder(id: number) {
  const after = useAfterChange(id);
  return useMutation({
    mutationFn: ({
      reason,
      restoreStock,
    }: {
      reason: string;
      restoreStock: boolean;
    }) => cancelOrder(id, reason, restoreStock),
    onSuccess: after,
  });
}
