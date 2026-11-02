import { useEffect, useState } from "react";

/**
 * After a broadcast (an "all customers" campaign) is accepted, broadcasting is locked for this
 * long. The backend has no idempotency key, so a nervous double-click would send twice; this
 * is a client-side guard only, kept in memory at module level so that leaving the compose page
 * and coming back does not reset it (a page reload does, which is the best a browser can do).
 */
export const COOLDOWN_MS = 30_000;

let lastBroadcastAt: number | null = null;
const listeners = new Set<() => void>();

export function startBroadcastCooldown(now: number = Date.now()): void {
  lastBroadcastAt = now;
  for (const listener of listeners) listener();
}

export function cooldownRemainingMs(now: number = Date.now()): number {
  if (lastBroadcastAt === null) return 0;
  return Math.max(0, lastBroadcastAt + COOLDOWN_MS - now);
}

/** Tests only. */
export function resetBroadcastCooldown(): void {
  lastBroadcastAt = null;
  for (const listener of listeners) listener();
}

/** Re-renders every half second while the lock is on; `seconds` is what is left, rounded up. */
export function useBroadcastCooldown(): { active: boolean; seconds: number } {
  const [, setTick] = useState(0);
  const remaining = cooldownRemainingMs();
  const locked = remaining > 0;
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, [locked]);
  return { active: locked, seconds: Math.ceil(remaining / 1000) };
}
