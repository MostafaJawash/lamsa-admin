import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  CATALOG_STALE_MS,
  flattenTree,
  useCategoryTree,
} from "@/features/categories";
import { useBrands } from "@/features/brands";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/errors";
import { useMemo } from "react";

import type { LinkOut, LinkType, NameLookup } from "./link";
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  reorderBanners,
  replaceBannerImage,
  updateBanner,
  type Banner,
  type BannerCreateInput,
  type BannerUpdateBody,
} from "./requests";

export type { Banner };

export const bannerKeys = {
  all: ["banners"] as const,
  list: ["banners", "list"] as const,
};

/** The whole banner list (flat, in display order, not paged). */
export function useBanners() {
  return useQuery({ queryKey: bannerKeys.list, queryFn: fetchBanners });
}

function useInvalidateBanners() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: bannerKeys.all });
}

export function useCreateBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: (input: BannerCreateInput) => createBanner(input),
    onSuccess: invalidate,
  });
}

export function useUpdateBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: BannerUpdateBody }) =>
      updateBanner(id, body),
    onSuccess: invalidate,
  });
}

export function useReplaceBannerImage() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      replaceBannerImage(id, file),
    onSuccess: invalidate,
  });
}

export function useDeleteBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: (id: number) => deleteBanner(id),
    onSuccess: invalidate,
  });
}

/** The backend answers with the reordered list: it replaces the cached one. */
export function useReorderBanners() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => reorderBanners(ids),
    onSuccess: (list) => client.setQueryData(bannerKeys.list, list),
    onSettled: () => client.invalidateQueries({ queryKey: bannerKeys.all }),
  });
}

/**
 * The public product endpoint only answers for products the store shows. It is the one
 * lookup by slug the API offers, so a 404 doubles as "this target is hidden from customers"
 * (the same rule the storefront applies to banners).
 */
export function useProductBySlug(slug: string | null) {
  return useQuery({
    queryKey: ["banners", "product-slug", slug],
    enabled: Boolean(slug),
    staleTime: CATALOG_STALE_MS,
    queryFn: async () => {
      try {
        const product = await unwrap(
          api.GET("/products/{slug}", {
            params: { path: { slug: slug as string } },
          }),
        );
        return { name: product.name, visible: true };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404)
          return { name: null, visible: false };
        throw error;
      }
    },
  });
}

export type LinkTargetInfo = {
  /** Display name of the target when known. */
  name: string | undefined;
  /** False only when the target is known to be hidden from customers. */
  visible: boolean;
};

/**
 * Names and visibility of a link's target: categories and brands from the admin lists
 * (cached, include inactive ones), a product from the public lookup above.
 */
export function useLinkTarget(link: LinkOut): LinkTargetInfo {
  const categories = useCategoryTree();
  const brands = useBrands();
  const product = useProductBySlug(
    link.type === "product" ? (link.value ?? null) : null,
  );
  return useMemo(() => {
    const slug = link.value ?? "";
    if (link.type === "product")
      return product.data
        ? {
            name: product.data.name ?? undefined,
            visible: product.data.visible,
          }
        : { name: undefined, visible: true };
    if (link.type === "category") {
      const row = flattenTree(categories.data ?? []).find(
        (r) => r.node.slug === slug,
      );
      return row
        ? { name: row.node.name, visible: !row.hidden }
        : { name: undefined, visible: !categories.data };
    }
    if (link.type === "brand") {
      const brand = brands.data?.find((b) => b.slug === slug);
      return brand
        ? { name: brand.name, visible: brand.is_active }
        : { name: undefined, visible: !brands.data };
    }
    return { name: undefined, visible: true };
  }, [link.type, link.value, categories.data, brands.data, product.data]);
}

export function lookupFrom(info: LinkTargetInfo): NameLookup {
  return (_type: LinkType, _slug: string) => info.name;
}
