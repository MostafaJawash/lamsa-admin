/**
 * Upload rules the backend applies to every image (`MAX_UPLOAD_MB=5`; JPEG, PNG or WEBP).
 * The server stays the authority (`FILE_TOO_LARGE`, `INVALID_IMAGE`); this only saves a round trip.
 */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ImageFileCheck = "ok" | "type" | "size";

export function checkImageFile(file: {
  type: string;
  size: number;
}): ImageFileCheck {
  if (!IMAGE_TYPES.includes(file.type)) return "type";
  if (file.size > IMAGE_MAX_BYTES) return "size";
  return "ok";
}
