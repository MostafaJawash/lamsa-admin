import { configure } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The first render of a heavy page can take over a second when many test files run at once.
configure({ asyncUtilTimeout: 5000 });

// Radix (Select, Dialog) needs a few browser APIs that jsdom lacks.
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
