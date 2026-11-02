import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { ListParams } from "./list-filters";
import {
  fetchCustomer,
  fetchCustomers,
  resetCustomerPassword,
  setCustomerActive,
} from "./requests";

export const customerKeys = {
  all: ["customers"] as const,
  list: (params: ListParams) => ["customers", "list", params] as const,
  detail: (id: number) => ["customers", "detail", id] as const,
};

export function useCustomers(params: ListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => fetchCustomers(params),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: number | null) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? 0),
    queryFn: () => fetchCustomer(id as number),
    enabled: id !== null,
  });
}

/** The answer replaces the cached customer; the lists refetch (status and counts change). */
export function useSetCustomerActive(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => setCustomerActive(id, active),
    onSuccess: (customer) => {
      client.setQueryData(customerKeys.detail(id), customer);
      void client.invalidateQueries({ queryKey: ["customers", "list"] });
    },
  });
}

/**
 * The temporary password exists only in this mutation's result: it is never put in the query
 * cache, kept for no time at all once unobserved (`gcTime: 0`), and cleared by `reset()` when
 * the admin closes the dialog.
 */
export function useResetPassword(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => resetCustomerPassword(id),
    gcTime: 0,
    // The customer now has `must_change_password`: refetch the profile (not the password).
    onSuccess: () =>
      client.invalidateQueries({ queryKey: customerKeys.detail(id) }),
  });
}
