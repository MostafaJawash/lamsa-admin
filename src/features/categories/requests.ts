import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];
export type CategoryCreateBody = Schemas["CategoryCreate"];
export type CategoryUpdateBody = Schemas["CategoryUpdate"];
export type AttributeCreateBody = Schemas["AttributeCreate"];
export type AttributeUpdateBody = Schemas["AttributeUpdate"];
export type VariantOptionCreateBody = Schemas["VariantOptionCreate"];
export type VariantOptionUpdateBody = Schemas["VariantOptionUpdate"];

/** One function per backend call (all under /admin/categories). */

export function createCategory(body: CategoryCreateBody) {
  return unwrap(api.POST("/admin/categories", { body }));
}

export function updateCategory(id: number, body: CategoryUpdateBody) {
  return unwrap(
    api.PATCH("/admin/categories/{category_id}", {
      params: { path: { category_id: id } },
      body,
    }),
  );
}

export async function deleteCategory(id: number): Promise<void> {
  await unwrap(
    api.DELETE("/admin/categories/{category_id}", {
      params: { path: { category_id: id } },
    }),
  );
}

export function setCategoryImage(id: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  return unwrap(
    api.PUT("/admin/categories/{category_id}/image", {
      params: { path: { category_id: id } },
      body: { file: "" },
      bodySerializer: () => form,
    }),
  );
}

export function deleteCategoryImage(id: number) {
  return unwrap(
    api.DELETE("/admin/categories/{category_id}/image", {
      params: { path: { category_id: id } },
    }),
  );
}

export function createAttribute(categoryId: number, body: AttributeCreateBody) {
  return unwrap(
    api.POST("/admin/categories/{category_id}/attributes", {
      params: { path: { category_id: categoryId } },
      body,
    }),
  );
}

export function updateAttribute(
  categoryId: number,
  attributeId: number,
  body: AttributeUpdateBody,
) {
  return unwrap(
    api.PATCH("/admin/categories/{category_id}/attributes/{attribute_id}", {
      params: { path: { category_id: categoryId, attribute_id: attributeId } },
      body,
    }),
  );
}

/** `force` also removes the attribute's key from every product that uses it. */
export async function deleteAttribute(
  categoryId: number,
  attributeId: number,
  force: boolean,
): Promise<void> {
  await unwrap(
    api.DELETE("/admin/categories/{category_id}/attributes/{attribute_id}", {
      params: {
        path: { category_id: categoryId, attribute_id: attributeId },
        query: { force },
      },
    }),
  );
}

export function createVariantOption(
  categoryId: number,
  body: VariantOptionCreateBody,
) {
  return unwrap(
    api.POST("/admin/categories/{category_id}/variant-options", {
      params: { path: { category_id: categoryId } },
      body,
    }),
  );
}

export function updateVariantOption(
  categoryId: number,
  optionId: number,
  body: VariantOptionUpdateBody,
) {
  return unwrap(
    api.PATCH("/admin/categories/{category_id}/variant-options/{option_id}", {
      params: { path: { category_id: categoryId, option_id: optionId } },
      body,
    }),
  );
}

export async function deleteVariantOption(
  categoryId: number,
  optionId: number,
): Promise<void> {
  await unwrap(
    api.DELETE("/admin/categories/{category_id}/variant-options/{option_id}", {
      params: { path: { category_id: categoryId, option_id: optionId } },
    }),
  );
}
