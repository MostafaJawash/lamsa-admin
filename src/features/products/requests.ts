import { api, unwrap } from "@/lib/api/client";

import type { BundleItemBody } from "./bundle";
import { PAGE_SIZE, type ListParams } from "./list-filters";
import type {
  ProductCreateBody,
  ProductUpdateBody,
  VariantCreateBody,
  VariantUpdateBody,
} from "./types";

/** One function per backend call, so hooks and the save flow share them. */

export function fetchProducts(params: ListParams) {
  return unwrap(
    api.GET("/admin/products", {
      params: {
        query: {
          page: params.page,
          page_size: PAGE_SIZE,
          q: params.q.trim() || undefined,
          category_id: params.category ?? undefined,
          brand_id: params.brand ?? undefined,
          type: params.type === "all" ? undefined : params.type,
          is_active:
            params.status === "all" ? undefined : params.status === "active",
          sort: params.sort,
        },
      },
    }),
  );
}

export function fetchProduct(id: number) {
  return unwrap(
    api.GET("/admin/products/{product_id}", {
      params: { path: { product_id: id } },
    }),
  );
}

export function createProduct(body: ProductCreateBody) {
  return unwrap(api.POST("/admin/products", { body }));
}

export function updateProduct(id: number, body: ProductUpdateBody) {
  return unwrap(
    api.PATCH("/admin/products/{product_id}", {
      params: { path: { product_id: id } },
      body,
    }),
  );
}

export async function deleteProduct(id: number): Promise<void> {
  await unwrap(
    api.DELETE("/admin/products/{product_id}", {
      params: { path: { product_id: id } },
    }),
  );
}

export function adjustStock(id: number, delta: number, reason?: string) {
  return unwrap(
    api.POST("/admin/products/{product_id}/stock-adjust", {
      params: { path: { product_id: id } },
      body: { delta, reason: reason || null },
    }),
  );
}

export function adjustVariantStock(
  id: number,
  variantId: number,
  delta: number,
  reason?: string,
) {
  return unwrap(
    api.POST(
      "/admin/products/{product_id}/variants/{variant_id}/stock-adjust",
      {
        params: { path: { product_id: id, variant_id: variantId } },
        body: { delta, reason: reason || null },
      },
    ),
  );
}

export function addVariant(id: number, body: VariantCreateBody) {
  return unwrap(
    api.POST("/admin/products/{product_id}/variants", {
      params: { path: { product_id: id } },
      body,
    }),
  );
}

export function patchVariant(
  id: number,
  variantId: number,
  body: VariantUpdateBody,
) {
  return unwrap(
    api.PATCH("/admin/products/{product_id}/variants/{variant_id}", {
      params: { path: { product_id: id, variant_id: variantId } },
      body,
    }),
  );
}

export function removeVariant(id: number, variantId: number) {
  return unwrap(
    api.DELETE("/admin/products/{product_id}/variants/{variant_id}", {
      params: { path: { product_id: id, variant_id: variantId } },
    }),
  );
}

/** Full replace of the bundle's contents (an empty list empties the bundle). */
export function replaceBundleItems(id: number, items: BundleItemBody[]) {
  return unwrap(
    api.PUT("/admin/products/{product_id}/bundle-items", {
      params: { path: { product_id: id } },
      body: { items },
    }),
  );
}

/** One image per request, so each file succeeds or fails on its own. `color` links it to a color. */
export function uploadImage(id: number, file: File, color?: string) {
  const form = new FormData();
  form.append("files", file);
  if (color) form.append("color", color);
  return unwrap(
    api.POST("/admin/products/{product_id}/images", {
      params: { path: { product_id: id } },
      body: { files: [] },
      bodySerializer: () => form,
    }),
  );
}

export function deleteImage(id: number, imageId: number) {
  return unwrap(
    api.DELETE("/admin/products/{product_id}/images/{image_id}", {
      params: { path: { product_id: id, image_id: imageId } },
    }),
  );
}

export function reorderImages(id: number, imageIds: number[]) {
  return unwrap(
    api.PUT("/admin/products/{product_id}/images/order", {
      params: { path: { product_id: id } },
      body: { image_ids: imageIds },
    }),
  );
}

export function updateImageAlt(id: number, imageId: number, altText: string) {
  return unwrap(
    api.PATCH("/admin/products/{product_id}/images/{image_id}", {
      params: { path: { product_id: id, image_id: imageId } },
      body: { alt_text: altText },
    }),
  );
}
