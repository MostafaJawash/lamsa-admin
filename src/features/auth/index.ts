/**
 * features/auth: everything about who is signed in.
 *
 * Belongs here: the auth guard, session hooks, the login form's schema and mutation,
 * "current admin" helpers. The token store itself lives in src/lib/auth/session.ts
 * (it is infrastructure the API client depends on).
 *
 * Does not belong here: layout, generic UI, other domains' logic.
 */
export { AuthGuard } from "./auth-guard";
export { useSession } from "./use-session";
