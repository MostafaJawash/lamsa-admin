import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";

import { ApiError, errorMessage, fieldErrors } from "@/lib/errors";

type Options = {
  /** Backend error code -> the form field it belongs to (when the error has no `details.field`). */
  codeFields?: Readonly<Record<string, string>>;
  /** Fields of the form; a backend field that is not one of these goes to the toast list. */
  fields: readonly string[];
};

/**
 * Puts a backend error on the form field it names and returns the messages that belong to no
 * field (show those in a toast). Backend shapes: `details: [{field, message}]` for 422 and
 * field errors, and business codes such as SLUG_TAKEN that name their field implicitly.
 * Business errors carry the backend's Arabic message; pydantic's own text is English but is
 * all there is for VALIDATION_ERROR.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  { codeFields = {}, fields }: Options,
): string[] {
  if (!(error instanceof ApiError)) return [errorMessage(error)];
  const unmapped: string[] = [];
  const attach = (field: string, message: string) =>
    setError(field as FieldPath<T>, { type: "server", message });

  const items = fieldErrors(error);
  if (items.length > 0) {
    for (const { field, message } of items) {
      const text =
        error.code === "VALIDATION_ERROR" ? message : errorMessage(error);
      if (fields.includes(field)) attach(field, text);
      else unmapped.push(text);
    }
    return unmapped;
  }
  const field = codeFields[error.code];
  if (field && fields.includes(field)) {
    attach(field, errorMessage(error));
    return unmapped;
  }
  unmapped.push(errorMessage(error));
  return unmapped;
}
