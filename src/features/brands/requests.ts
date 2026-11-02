import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

import { PAGE_SIZE, type ListParams } from "./list-filters";

export type BrandCreateBody = components["schemas"]["BrandCreate"];
export type BrandUpdateBody = components["schemas"]["BrandUpdate"];

export function fetchBrands(params: ListParams) {
  return unwrap(
    api.GET("/admin/brands", {
      params: {
        query: {
          page: params.page,
          page_size: PAGE_SIZE,
          search: params.q.trim() || undefined,
          is_active:
            params.status === "all" ? undefined : params.status === "active",
        },
      },
    }),
  );
}

export function createBrand(body: BrandCreateBody) {
  return unwrap(api.POST("/admin/brands", { body }));
}

export function updateBrand(id: number, body: BrandUpdateBody) {
  return unwrap(
    api.PATCH("/admin/brands/{brand_id}", {
      params: { path: { brand_id: id } },
      body,
    }),
  );
}

export async function deleteBrand(id: number): Promise<void> {
  await unwrap(
    api.DELETE("/admin/brands/{brand_id}", {
      params: { path: { brand_id: id } },
    }),
  );
}

export function setBrandLogo(id: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  return unwrap(
    api.PUT("/admin/brands/{brand_id}/logo", {
      params: { path: { brand_id: id } },
      body: { file: "" },
      bodySerializer: () => form,
    }),
  );
}

export function deleteBrandLogo(id: number) {
  return unwrap(
    api.DELETE("/admin/brands/{brand_id}/logo", {
      params: { path: { brand_id: id } },
    }),
  );
}
