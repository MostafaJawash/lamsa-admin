import createClient, { type Client } from "openapi-fetch";

import { env } from "@/lib/env";
import { ApiError, isApiErrorBody } from "@/lib/errors";

import type { paths as GeneratedPaths } from "./schema";

/**
 * `VITE_API_BASE_URL` already ends in `/api/v1`, so the generated paths are re-keyed
 * without that prefix (same as lamsa-web): `api.GET('/admin/orders')`.
 */
type ApiPrefix = "/api/v1";
export type ApiPaths = {
  [
    P in keyof GeneratedPaths as P extends `${ApiPrefix}${infer Rest}`
      ? Rest
      : never
  ]: GeneratedPaths[P];
};
export type ApiClient = Client<ApiPaths>;

export const API_TIMEOUT_MS = 10_000;
/** Image uploads (multipart) get longer: a few MB over a slow link. */
export const UPLOAD_TIMEOUT_MS = 60_000;

/** Maps any failed response to a typed `ApiError` (`{error: {code, message, details}}`). */
export function toApiError(response: Response, body: unknown): ApiError {
  const retryAfterHeader = response.headers.get("Retry-After");
  const parsed = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : null;
  const retryAfter = parsed !== null && Number.isFinite(parsed) ? parsed : null;
  if (isApiErrorBody(body)) {
    const { code, message, details } = body.error;
    return new ApiError(
      response.status,
      code,
      typeof message === "string" && message ? message : null,
      details ?? null,
      retryAfter,
    );
  }
  return new ApiError(response.status, "HTTP_ERROR", null, null, retryAfter);
}

/** One fetch with a timeout; network failures become `ApiError`s with status 0. */
export async function fetchWithTimeout(request: Request): Promise<Response> {
  const isUpload = request.headers
    .get("Content-Type")
    ?.startsWith("multipart/form-data");
  const signal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(isUpload ? UPLOAD_TIMEOUT_MS : API_TIMEOUT_MS),
  ]);
  try {
    return await fetch(request, { signal });
  } catch (cause) {
    const timedOut =
      cause instanceof DOMException && cause.name === "TimeoutError";
    throw new ApiError(0, timedOut ? "TIMEOUT" : "NETWORK_ERROR", null);
  }
}

/** Client that sends no token. Used for login/refresh/logout (the session module owns tokens). */
export const bareApi: ApiClient = createClient<ApiPaths>({
  baseUrl: env.API_BASE_URL,
  fetch: fetchWithTimeout,
  headers: { Accept: "application/json" },
});

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Returns `data` or throws an `ApiError`:
 * `const page = await unwrap(api.GET('/admin/orders', { params: { query } }))`.
 */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) throw toApiError(response, error);
  return data as T;
}
