import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

import {
  createAttribute,
  createCategory,
  createVariantOption,
  deleteAttribute,
  deleteCategory,
  deleteCategoryImage,
  deleteVariantOption,
  setCategoryImage,
  updateAttribute,
  updateCategory,
  updateVariantOption,
  type AttributeCreateBody,
  type AttributeUpdateBody,
  type CategoryCreateBody,
  type CategoryUpdateBody,
  type VariantOptionCreateBody,
  type VariantOptionUpdateBody,
} from "./requests";

export type CategoryNode = components["schemas"]["AdminCategoryNode"];
export type CategoryDetail = components["schemas"]["AdminCategoryDetail"];
export type CategoryAttribute = components["schemas"]["AdminAttributeOut"];
export type CategoryVariantOption =
  components["schemas"]["AdminVariantOptionOut"];

/** Categories and brands change rarely: keep them for five minutes. */
export const CATALOG_STALE_MS = 5 * 60_000;

export const categoryKeys = {
  all: ["categories"] as const,
  tree: ["categories", "tree"] as const,
  detail: (id: number) => ["categories", "detail", id] as const,
};

/** The whole category tree (two levels at most), including inactive categories. */
export function useCategoryTree() {
  return useQuery({
    queryKey: categoryKeys.tree,
    queryFn: () => unwrap(api.GET("/admin/categories")),
    staleTime: CATALOG_STALE_MS,
  });
}

function fetchCategory(id: number) {
  return unwrap(
    api.GET("/admin/categories/{category_id}", {
      params: { path: { category_id: id } },
    }),
  );
}

/** One category with its effective (inherited + own) attribute and variant-option definitions. */
export function useCategoryDetail(id: number | null) {
  return useQuery({
    queryKey: categoryKeys.detail(id ?? 0),
    queryFn: () => fetchCategory(id as number),
    enabled: id !== null,
    staleTime: CATALOG_STALE_MS,
  });
}

/** The edit page always reads fresh data (same cache entry as the products form uses). */
export function useCategoryForEdit(id: number | null) {
  return useQuery({
    queryKey: categoryKeys.detail(id ?? 0),
    queryFn: () => fetchCategory(id as number),
    enabled: id !== null,
    staleTime: 0,
  });
}

export type CategoryOption = { id: number; label: string; inactive: boolean };

/**
 * Tree to a flat, ordered list; children are prefixed so the hierarchy shows in a select.
 * `inactive` is true for a category that is inactive itself or sits in an inactive parent
 * (the backend refuses to publish products there: CATEGORY_INACTIVE).
 */
export function flattenCategories(
  nodes: readonly CategoryNode[],
): CategoryOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: node.name, inactive: node.is_active === false },
    ...(node.children ?? []).map((child) => ({
      id: child.id,
      label: `${node.name} ‹ ${child.name}`,
      inactive: node.is_active === false || child.is_active === false,
    })),
  ]);
}

/**
 * Anything changed here shows up in Products (selects, dynamic fields, lists) in the same
 * session: the category and brand queries are shared, so they are refetched together.
 */
export function useInvalidateCatalog() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: categoryKeys.all }),
      client.invalidateQueries({ queryKey: ["products"] }),
    ]);
}

export function useCreateCategory() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (body: CategoryCreateBody) => createCategory(body),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory(id: number) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (body: CategoryUpdateBody) => updateCategory(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: invalidate,
  });
}

export function useCategoryImage(id: number) {
  const invalidate = useInvalidateCatalog();
  const set = useMutation({
    mutationFn: (file: File) => setCategoryImage(id, file),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => deleteCategoryImage(id),
    onSuccess: invalidate,
  });
  return { set, remove };
}

export function useAttributeMutations(categoryId: number) {
  const invalidate = useInvalidateCatalog();
  return {
    create: useMutation({
      mutationFn: (body: AttributeCreateBody) =>
        createAttribute(categoryId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: AttributeUpdateBody }) =>
        updateAttribute(categoryId, id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: ({ id, force }: { id: number; force: boolean }) =>
        deleteAttribute(categoryId, id, force),
      onSuccess: invalidate,
    }),
  };
}

export function useVariantOptionMutations(categoryId: number) {
  const invalidate = useInvalidateCatalog();
  return {
    create: useMutation({
      mutationFn: (body: VariantOptionCreateBody) =>
        createVariantOption(categoryId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        body,
      }: {
        id: number;
        body: VariantOptionUpdateBody;
      }) => updateVariantOption(categoryId, id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: number) => deleteVariantOption(categoryId, id),
      onSuccess: invalidate,
    }),
  };
}
