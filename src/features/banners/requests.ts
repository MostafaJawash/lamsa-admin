import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Banner = components["schemas"]["AdminBannerOut"];
export type BannerUpdateBody = components["schemas"]["BannerUpdate"];

export type BannerCreateInput = {
  image: File;
  title: string;
  subtitle: string | null;
  link: { type: components["schemas"]["LinkType"]; value: string | null };
  is_active: boolean;
  /** UTC ISO strings. */
  starts_at: string | null;
  ends_at: string | null;
};

export function fetchBanners() {
  return unwrap(api.GET("/admin/banners"));
}

/** Multipart, as the backend requires; `is_active` is the string "true"/"false" on purpose. */
export function createBanner(input: BannerCreateInput) {
  const form = new FormData();
  form.append("image", input.image);
  form.append("title", input.title);
  if (input.subtitle) form.append("subtitle", input.subtitle);
  form.append("link_type", input.link.type);
  if (input.link.value) form.append("link_value", input.link.value);
  form.append("is_active", input.is_active ? "true" : "false");
  if (input.starts_at) form.append("starts_at", input.starts_at);
  if (input.ends_at) form.append("ends_at", input.ends_at);
  return unwrap(
    api.POST("/admin/banners", {
      body: { image: "", title: "", link_type: "none" },
      bodySerializer: () => form,
    }),
  );
}

export function updateBanner(id: number, body: BannerUpdateBody) {
  return unwrap(
    api.PATCH("/admin/banners/{banner_id}", {
      params: { path: { banner_id: id } },
      body,
    }),
  );
}

export function replaceBannerImage(id: number, file: File) {
  const form = new FormData();
  form.append("image", file);
  return unwrap(
    api.PUT("/admin/banners/{banner_id}/image", {
      params: { path: { banner_id: id } },
      body: { image: "" },
      bodySerializer: () => form,
    }),
  );
}

export async function deleteBanner(id: number): Promise<void> {
  await unwrap(
    api.DELETE("/admin/banners/{banner_id}", {
      params: { path: { banner_id: id } },
    }),
  );
}

/** Every banner id exactly once; the first is shown first. */
export function reorderBanners(bannerIds: number[]) {
  return unwrap(
    api.PUT("/admin/banners/order", { body: { banner_ids: bannerIds } }),
  );
}
