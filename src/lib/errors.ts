import { m } from "@/messages";

/** The backend's error body: `{error: {code, message, details}}`. */
export type ApiErrorBody = {
  error: { code: string; message?: string | null; details?: unknown };
};

export function isApiErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body))
    return false;
  const error = (body as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

/**
 * Any failed backend call. `status` 0 means no response (`NETWORK_ERROR` / `TIMEOUT`).
 * Branch on `code` (stable, English); show `userMessage` (Arabic).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly serverMessage: string | null;
  readonly details: unknown;
  readonly retryAfter: number | null;

  constructor(
    status: number,
    code: string,
    serverMessage: string | null,
    details: unknown = null,
    retryAfter: number | null = null,
  ) {
    super(`${code}${serverMessage ? `: ${serverMessage}` : ""}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
    this.details = details;
    this.retryAfter = retryAfter;
  }

  get userMessage(): string {
    return errorMessage(this);
  }
}

/** The Arabic text to show for an error: the backend's own message first, then a fallback. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.serverMessage) return error.serverMessage;
    if (error.code === "NETWORK_ERROR") return m.errors.network;
    if (error.code === "TIMEOUT") return m.errors.timeout;
    return m.errors.byCode[error.code] ?? m.errors.unknown;
  }
  return m.errors.unknown;
}

/** `VALIDATION_ERROR` details are `{field, message}[]`; anything else gives `[]`. */
export function fieldErrors(
  error: ApiError,
): { field: string; message: string }[] {
  if (!Array.isArray(error.details)) return [];
  return error.details.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return [];
    const { field, message } = item as { field?: unknown; message?: unknown };
    return typeof field === "string" && typeof message === "string"
      ? [{ field, message }]
      : [];
  });
}
