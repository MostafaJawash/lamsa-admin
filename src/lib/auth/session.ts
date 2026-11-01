import { bareApi, toApiError, unwrap } from "@/lib/api/base";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/errors";
import { m } from "@/messages";

/**
 * In-memory session. Tokens live ONLY in this module's variables: never localStorage,
 * sessionStorage, cookies or IndexedDB (an XSS bug could read those). A hard reload
 * therefore ends the session and the user logs in again; that is deliberate (see README).
 *
 * Refresh tokens are single-use on the backend, so refreshes are single-flight: any number
 * of callers share one in-flight request. A timer refreshes shortly before the access
 * token expires, and `api` refreshes once and retries when a call returns TOKEN_EXPIRED.
 */

type TokenPair = components["schemas"]["TokenPair"];
export type SessionUser = TokenPair["user"];

export type SessionState =
  | { status: "anonymous"; notice: string | null }
  | { status: "authenticated"; user: SessionUser };

/** Refresh this long before the access token expires. */
const REFRESH_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inflightRefresh: Promise<boolean> | null = null;
let state: SessionState = { status: "anonymous", notice: null };
const listeners = new Set<() => void>();

function setState(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener();
}

function clearTimer(): void {
  if (refreshTimer !== null) clearTimeout(refreshTimer);
  refreshTimer = null;
}

function scheduleRefresh(expiresInSeconds: number): void {
  clearTimer();
  const delay = Math.max(
    expiresInSeconds * 1000 - REFRESH_MARGIN_MS,
    MIN_REFRESH_DELAY_MS,
  );
  refreshTimer = setTimeout(() => {
    void refreshSession();
  }, delay);
}

function applyTokens(pair: TokenPair): void {
  accessToken = pair.access_token;
  refreshToken = pair.refresh_token;
  scheduleRefresh(pair.expires_in);
  setState({ status: "authenticated", user: pair.user });
}

function clearTokens(notice: string | null): void {
  clearTimer();
  accessToken = null;
  refreshToken = null;
  setState({ status: "anonymous", notice });
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getSessionState(): SessionState {
  return state;
}

export function isAdminSession(): boolean {
  return state.status === "authenticated" && state.user.role === "admin";
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Best effort: ends the session on the server so a rejected or finished login leaves no live token. */
async function revokeOnServer(token: string): Promise<void> {
  try {
    await bareApi.POST("/auth/logout", { body: { refresh_token: token } });
  } catch {
    // The local session is cleared either way; the token expires on its own.
  }
}

/**
 * Phone + password login. Only `role === 'admin'` gets a session: for any other account the
 * just-issued session is revoked on the server and a clear Arabic error is thrown.
 */
export async function login(
  phone: string,
  password: string,
): Promise<SessionUser> {
  const pair = await unwrap(
    bareApi.POST("/auth/login", {
      body: { phone, password, device_name: m.app.adminTitle },
    }),
  );
  if (pair.user.role !== "admin") {
    await revokeOnServer(pair.refresh_token);
    throw new ApiError(403, "ADMIN_ONLY", m.auth.notAdmin);
  }
  applyTokens(pair);
  return pair.user;
}

export async function logout(): Promise<void> {
  const token = refreshToken;
  clearTokens(null);
  if (token) await revokeOnServer(token);
}

async function doRefresh(): Promise<boolean> {
  const token = refreshToken;
  if (!token) return false;
  try {
    const { data, error, response } = await bareApi.POST("/auth/refresh", {
      body: { refresh_token: token },
    });
    if (!response.ok || !data) {
      const apiError = toApiError(response, error);
      // A network blip must not end the session; the next call retries. Anything the
      // backend answered (invalid, reused, expired, disabled) does.
      if (apiError.status === 0 || apiError.status >= 500) return false;
      clearTokens(m.auth.sessionEnded);
      return false;
    }
    if (data.user.role !== "admin") {
      clearTokens(m.auth.notAdmin);
      return false;
    }
    applyTokens(data);
    return true;
  } catch {
    // Network failure or timeout: keep the session, try again soon.
    scheduleRefresh(0);
    return false;
  }
}

/** Single-flight refresh. Resolves true when a new access token is in place. */
export function refreshSession(): Promise<boolean> {
  inflightRefresh ??= doRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}
