import type { FieldPath, UseFormSetError } from "react-hook-form";

import { ApiError, errorMessage, fieldErrors } from "@/lib/errors";
import { m } from "@/messages";

import type { ProductFormValues } from "./schema";

const TOP_LEVEL_FIELDS = new Set([
  "name",
  "description",
  "category_id",
  "brand_id",
  "currency",
  "sku",
  "slug",
  "price",
  "sale_price",
  "stock",
  "type",
]);

function isFormField(field: string): boolean {
  return (
    TOP_LEVEL_FIELDS.has(field) ||
    /^variants\.\d+\.(price|sale_price|stock|sku|options)$/.test(field) ||
    /^attributes\.[^.]+$/.test(field)
  );
}

function asRecord(details: unknown): Record<string, unknown> {
  return typeof details === "object" &&
    details !== null &&
    !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

/**
 * Puts a backend error on the form field it belongs to and returns the messages that could
 * not be attached to a field (show those in a toast).
 *
 * The backend's shapes (see lamsa-backend `app/core/errors.py` and `shared/catalog.py`):
 *  - 422 VALIDATION_ERROR and field errors: `details: [{field, message}]`, dotted paths
 *    such as `variants.0.price`;
 *  - INVALID_ATTRIBUTE_VALUE / UNKNOWN_ATTRIBUTE: `details: {key}`;
 *  - MISSING_REQUIRED_ATTRIBUTE: `details: {keys: [...]}`;
 *  - SLUG_TAKEN / SKU_TAKEN: no field, the code names it.
 */
export function applyApiError(
  error: unknown,
  setError: UseFormSetError<ProductFormValues>,
): string[] {
  if (!(error instanceof ApiError)) return [errorMessage(error)];
  const unmapped: string[] = [];
  const attach = (path: string, message: string) =>
    setError(path as FieldPath<ProductFormValues>, {
      type: "server",
      message,
    });
  const details = asRecord(error.details);

  const items = fieldErrors(error);
  if (items.length > 0) {
    for (const { field, message } of items) {
      // Business errors carry the backend's Arabic message; pydantic's own text is English.
      const text =
        error.code === "VALIDATION_ERROR" ? message : errorMessage(error);
      if (isFormField(field)) attach(field, text);
      else unmapped.push(text);
    }
    return unmapped;
  }

  switch (error.code) {
    case "INVALID_ATTRIBUTE_VALUE":
    case "UNKNOWN_ATTRIBUTE":
      if (typeof details.key === "string") {
        attach(`attributes.${details.key}`, errorMessage(error));
        return unmapped;
      }
      break;
    case "MISSING_REQUIRED_ATTRIBUTE":
      if (Array.isArray(details.keys) && details.keys.length > 0) {
        for (const key of details.keys)
          attach(
            `attributes.${String(key)}`,
            m.products.form.validation.attributeRequired,
          );
        return unmapped;
      }
      break;
    case "SLUG_TAKEN":
      attach("slug", errorMessage(error));
      return unmapped;
    case "SKU_TAKEN":
      attach("sku", errorMessage(error));
      return unmapped;
  }
  unmapped.push(errorMessage(error));
  return unmapped;
}

/** Arabic reasons of a `PRODUCT_NOT_PUBLISHABLE` error (`details.reasons`), if it is one. */
export function publishReasons(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== "PRODUCT_NOT_PUBLISHABLE")
    return [];
  const reasons = asRecord(error.details).reasons;
  if (!Array.isArray(reasons)) return [];
  return reasons.map(
    (reason) =>
      m.products.form.publishReasons[String(reason)] ?? String(reason),
  );
}
