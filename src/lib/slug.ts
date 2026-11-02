/**
 * Slugs follow the backend (`app/shared/utils/slug.py`): lowercase latin letters and digits
 * separated by single dashes, 2 to 120 characters. Left empty, the backend builds one from the
 * name (it transliterates Arabic); a taken explicit slug is `409 SLUG_TAKEN`.
 */
export const SLUG_MIN = 2;
export const SLUG_MAX = 120;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return (
    value.length >= SLUG_MIN && value.length <= SLUG_MAX && SLUG.test(value)
  );
}

/**
 * A suggestion for a name written in latin letters ("Face Cream" -> "face-cream"). The browser
 * cannot transliterate Arabic reliably, so an Arabic name gives "" and the field is left to
 * the backend.
 */
export function suggestSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return isValidSlug(slug) ? slug : "";
}

/** True when the name has letters the suggestion cannot use (so the backend will generate the slug). */
export function hasNonLatinLetters(name: string): boolean {
  return /\p{L}/u.test(name.replace(/\p{Script=Latin}/gu, ""));
}
