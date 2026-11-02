import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type CategoryNode = components["schemas"]["AdminCategoryNode"];
export type CategoryDetail = components["schemas"]["AdminCategoryDetail"];
export type CategoryAttribute = components["schemas"]["AdminAttributeOut"];
export type CategoryVariantOption =
  components["schemas"]["AdminVariantOptionOut"];

/** Categories and brands change rarely: keep them for five minutes. */
export const CATALOG_STALE_MS = 5 * 60_000;

export const categoryKeys = {
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

/** One category with its effective (inherited + own) attribute and variant-option definitions. */
export function useCategoryDetail(id: number | null) {
  return useQuery({
    queryKey: categoryKeys.detail(id ?? 0),
    queryFn: () =>
      unwrap(
        api.GET("/admin/categories/{category_id}", {
          params: { path: { category_id: id as number } },
        }),
      ),
    enabled: id !== null,
    staleTime: CATALOG_STALE_MS,
  });
}

export type CategoryOption = { id: number; label: string };

/** Tree to a flat, ordered list; children are prefixed so the hierarchy shows in a select. */
export function flattenCategories(
  nodes: readonly CategoryNode[],
): CategoryOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: node.name },
    ...(node.children ?? []).map((child) => ({
      id: child.id,
      label: `${node.name} ‹ ${child.name}`,
    })),
  ]);
}
