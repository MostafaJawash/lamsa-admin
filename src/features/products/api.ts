import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { ListParams } from "./list-filters";
import {
  adjustStock,
  adjustVariantStock,
  deleteProduct,
  fetchProduct,
  fetchProducts,
} from "./requests";

export const productKeys = {
  all: ["products"] as const,
  list: (params: ListParams) => ["products", "list", params] as const,
  detail: (id: number) => ["products", "detail", id] as const,
};

/** Server-paged list; the previous page stays on screen while the next one loads. */
export function useProducts(params: ListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => fetchProducts(params),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? 0),
    queryFn: () => fetchProduct(id as number),
    enabled: id !== null,
    // The form owns the values while editing; do not refetch under it.
    staleTime: Infinity,
    gcTime: 0,
  });
}

/** Lists and the open product are stale after any product change. */
export function useInvalidateProducts() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: productKeys.all });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: invalidate,
  });
}

export type StockAdjustment = {
  productId: number;
  variantId?: number;
  delta: number;
  reason?: string;
};

/** The dedicated stock-adjust endpoints (atomic, never below zero). */
export function useAdjustStock() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, variantId, delta, reason }: StockAdjustment) =>
      variantId === undefined
        ? adjustStock(productId, delta, reason)
        : adjustVariantStock(productId, variantId, delta, reason),
    onSuccess: invalidate,
  });
}
