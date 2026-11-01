import { env } from "@/lib/env";

/**
 * The backend stores every image as WebP in three sizes (longest side, never upscaled):
 * thumb 300, medium 800, large 1600. Plain `<img srcset>`; images are never re-processed
 * on the client. Responses give `{thumb, medium, large}` URLs, or null.
 */
export const IMAGE_SIZES = { thumb: 300, medium: 800, large: 1600 } as const;
export type ImageSize = keyof typeof IMAGE_SIZES;
export type ImageUrls = Record<ImageSize, string>;

const SIZE_SUFFIX = /_(thumb|medium|large)\.webp$/;

/** Full URL of one size for a stored base key, e.g. `products/42/3f9c…e1`. */
export function buildImageUrl(
  imageKey: string,
  size: ImageSize,
  mediaBaseUrl: string = env.MEDIA_BASE_URL,
): string {
  const key = imageKey.replace(/^\/+/, "").replace(SIZE_SUFFIX, "");
  return `${mediaBaseUrl}/${key}_${size}.webp`;
}

/** `srcset` listing the three real files with their widths. */
export function srcSetFor(urls: ImageUrls): string {
  return (Object.keys(IMAGE_SIZES) as ImageSize[])
    .map((size) => `${urls[size]} ${IMAGE_SIZES[size]}w`)
    .join(", ");
}

/** `<img>` attributes for a backend image: `<img {...imageProps(urls, '80px')} alt="" />`. */
export function imageProps(urls: ImageUrls, sizes: string) {
  return { src: urls.medium, srcSet: srcSetFor(urls), sizes } as const;
}
