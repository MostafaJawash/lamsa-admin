import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/errors";

export type AttributeType = components["schemas"]["AttributeType"];
export type VariantOptionType = components["schemas"]["VariantOptionType"];

export const ATTRIBUTE_TYPES: readonly AttributeType[] = [
  "text",
  "number",
  "select",
  "multiselect",
  "boolean",
  "date",
];
export const VARIANT_OPTION_TYPES: readonly VariantOptionType[] = [
  "color",
  "select",
];

/** Attribute types whose values come from a list the admin defines (backend: SELECT_TYPES). */
export function attributeNeedsOptions(type: AttributeType): boolean {
  return type === "select" || type === "multiselect";
}

/** The kind of input the product form renders for an attribute type (see products' AttributeFields). */
export type ControlKind =
  "text" | "number" | "select" | "multiselect" | "checkbox" | "date";

export function controlFor(type: AttributeType): ControlKind {
  switch (type) {
    case "boolean":
      return "checkbox";
    default:
      return type;
  }
}

/** Definition keys: `^[a-z][a-z0-9_]{1,49}$`, unique per category and immutable. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export function isValidKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/** Splits options into the ones to send: trimmed, empty ones dropped. */
export function cleanOptions(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Extra context of an "in use" refusal: `details` is `{key, products_count}` (ATTRIBUTE_IN_USE),
 * `{value, products_count}` (OPTION_IN_USE) or `{key, variants_count}` (VARIANT_OPTION_IN_USE).
 * Returns "" for any other error.
 */
export function inUseDetails(error: unknown): string {
  if (!(error instanceof ApiError)) return "";
  if (
    !["ATTRIBUTE_IN_USE", "OPTION_IN_USE", "VARIANT_OPTION_IN_USE"].includes(
      error.code,
    )
  )
    return "";
  const d = (
    typeof error.details === "object" && error.details !== null
      ? error.details
      : {}
  ) as Record<string, unknown>;
  const count = d.products_count ?? d.variants_count;
  const subject = d.value ?? d.key;
  return [
    typeof subject === "string" ? subject : "",
    typeof count === "number" ? `(${count})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The number of products an ATTRIBUTE_IN_USE refusal reports, or null. */
export function productsInUse(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.code !== "ATTRIBUTE_IN_USE")
    return null;
  const d = error.details as { products_count?: unknown } | null;
  return typeof d?.products_count === "number" ? d.products_count : null;
}
