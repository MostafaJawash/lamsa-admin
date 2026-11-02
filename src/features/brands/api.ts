import { useQuery } from "@tanstack/react-query";

import { CATALOG_STALE_MS } from "@/features/categories";
import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Brand = components["schemas"]["AdminBrandOut"];

/** The backend caps `page_size` at 100; the store has far fewer brands than that. */
const BRAND_PAGE_SIZE = 100;

/** All brands (active and inactive) for selects. */
export function useBrands() {
  return useQuery({
    queryKey: ["brands", "options"],
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
