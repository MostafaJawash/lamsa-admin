import { useSyncExternalStore } from "react";

import {
  getSessionState,
  subscribeSession,
  type SessionState,
} from "@/lib/auth/session";

/** Reactive view of the in-memory session (see src/lib/auth/session.ts). */
export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribeSession,
    getSessionState,
    getSessionState,
  );
}
