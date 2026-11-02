import { vi } from "vitest";

/** Makes `window.matchMedia` answer for a viewport this wide (jsdom has none). Undo with `restoreMatchMedia`. */
export function setViewportWidth(width: number): void {
  vi.stubGlobal("matchMedia", (query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches =
      (max ? width <= Number(max[1]) : true) &&
      (min ? width >= Number(min[1]) : true);
    return {
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
}

export function restoreMatchMedia(): void {
  vi.unstubAllGlobals();
}
