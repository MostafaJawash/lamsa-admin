import { m } from "@/messages";

/** The backend's limits (README: MAX_UPLOAD_MB=5, JPEG/PNG/WEBP, at most 15 images per product). */
export const MAX_UPLOAD_MB = 5;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 15;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Checks picked files against the backend's rules before anything is uploaded.
 * `existing` is how many images the product already has (or has staged).
 * The server stays the authority (FILE_TOO_LARGE, INVALID_IMAGE, IMAGE_LIMIT_REACHED).
 */
export function validateImageFiles(
  files: readonly File[],
  existing: number,
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];
  const t = m.products.images;
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      errors.push(`${t.badType} ${file.name}`);
    } else if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${t.tooLarge} ${file.name}`);
    } else if (existing + accepted.length >= MAX_IMAGES_PER_PRODUCT) {
      if (!errors.includes(t.tooMany)) errors.push(t.tooMany);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, errors };
}

/** Moves one item; returns the same array when the move is out of range. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  if (to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
