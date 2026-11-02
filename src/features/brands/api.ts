import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { CATALOG_STALE_MS } from "@/features/categories";
import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

import type { ListParams } from "./list-filters";
import {
  createBrand,
  deleteBrand,
  deleteBrandLogo,
  fetchBrands,
  setBrandLogo,
  updateBrand,
  type BrandCreateBody,
  type BrandUpdateBody,
} from "./requests";

export type Brand = components["schemas"]["AdminBrandOut"];

export const brandKeys = {
  all: ["brands"] as const,
  options: ["brands", "options"] as const,
  list: (params: ListParams) => ["brands", "list", params] as const,
};

/** The backend caps `page_size` at 100; the store has far fewer brands than that. */
const BRAND_PAGE_SIZE = 100;

/** All brands (active and inactive) for selects. */
export function useBrands() {
  return useQuery({
    queryKey: brandKeys.options,
    queryFn: async () =>
      (
        await unwrap(
          api.GET("/admin/brands", {
            params: { query: { page: 1, page_size: BRAND_PAGE_SIZE } },
          }),
        )
      ).items,
    staleTime: CATALOG_STALE_MS,
  });
}

/** Server-paged brand list; the previous page stays on screen while the next one loads. */
export function useBrandList(params: ListParams) {
  return useQuery({
    queryKey: brandKeys.list(params),
    queryFn: () => fetchBrands(params),
    placeholderData: keepPreviousData,
  });
}

/** A brand change shows up in the products form's select and in product lists right away. */
function useInvalidateBrands() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: brandKeys.all }),
      client.invalidateQueries({ queryKey: ["products"] }),
    ]);
}

export function useCreateBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: (body: BrandCreateBody) => createBrand(body),
    onSuccess: invalidate,
  });
}

export function useUpdateBrand(id: number) {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: (body: BrandUpdateBody) => updateBrand(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: (id: number) => deleteBrand(id),
    onSuccess: invalidate,
  });
}

/** Logo upload/removal for a brand that exists (also used right after creating one). */
export function useBrandLogo() {
  const invalidate = useInvalidateBrands();
  return {
    set: useMutation({
      mutationFn: ({ id, file }: { id: number; file: File }) =>
        setBrandLogo(id, file),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: number) => deleteBrandLogo(id),
      onSuccess: invalidate,
    }),
  };
}
