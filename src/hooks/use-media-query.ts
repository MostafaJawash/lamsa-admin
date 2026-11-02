import { useSyncExternalStore } from "react";

/** Below this width (px) data tables render as stacked cards: Tailwind's `md` breakpoint. */
export const MOBILE_QUERY = "(max-width: 767px)";

/**
 * Live `window.matchMedia(query).matches`. Where `matchMedia` does not exist (jsdom) it is
 * `false`, so the desktop layout renders and tests need no stub unless they want mobile.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia(query).matches,
    () => false,
  );
}

/** True below the `md` breakpoint (phones and small portrait tablets). */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
