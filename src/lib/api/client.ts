import createClient from "openapi-fetch";

import { getAccessToken, refreshSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { isApiErrorBody } from "@/lib/errors";

import { fetchWithTimeout, type ApiClient, type ApiPaths } from "./base";

export { unwrap, toApiError, type ApiPaths, type ApiClient } from "./base";

async function isTokenExpired(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body: unknown = await response.clone().json();
    return isApiErrorBody(body) && body.error.code === "TOKEN_EXPIRED";
  } catch {
    return false;
  }
}

/**
 * fetch that attaches the in-memory access token. On `401 TOKEN_EXPIRED` it refreshes once
 * (single-flight, shared with the timer in the session module) and replays the request;
 * if the refresh fails the session is already cleared and the original 401 is returned.
 */
async function authedFetch(request: Request): Promise<Response> {
  const retry = request.clone();
  const token = getAccessToken();
  if (token) request.headers.set("Authorization", `Bearer ${token}`);
  const response = await fetchWithTimeout(request);
  if (!token || !(await isTokenExpired(response))) return response;

  if (!(await refreshSession())) return response;
  const fresh = getAccessToken();
  if (fresh) retry.headers.set("Authorization", `Bearer ${fresh}`);
  return fetchWithTimeout(retry);
}

/**
 * The admin API client (the browser calls the backend directly; there is no proxy).
 * Pair it with `unwrap` to get typed data or a thrown `ApiError`.
 */
export const api: ApiClient = createClient<ApiPaths>({
  baseUrl: env.API_BASE_URL,
  fetch: authedFetch,
  headers: { Accept: "application/json" },
});
