import { describe, expect, it } from "vitest";

import { formatMoney, sumByCurrency } from "@/lib/money";

describe("formatMoney", () => {
  it("formats SYP with grouping and the Arabic symbol, dropping the zero decimals", () => {
    expect(formatMoney("150000.00", "SYP")).toBe("150,000 ل.س");
    expect(formatMoney("0.00", "SYP")).toBe("0 ل.س");
  });

  it("formats USD with $ and only the decimals that matter", () => {
    expect(formatMoney("8.50", "USD")).toBe("8.5 $");
    expect(formatMoney("1250.00", "USD")).toBe("1,250 $");
    expect(formatMoney("12.34", "USD")).toBe("12.34 $");
  });

  it("keeps legacy EUR and prints unknown codes after the amount", () => {
    expect(formatMoney("8.95", "EUR")).toBe("8.95 €");
    expect(formatMoney("10.00", "XYZ")).toBe("10.00 XYZ");
  });

  it("returns text that is not an amount unchanged", () => {
    expect(formatMoney("abc", "SYP")).toBe("abc");
  });
});

describe("sumByCurrency", () => {
  it("keeps one bucket per currency and never mixes them, SYP first", () => {
    const totals = sumByCurrency([
      { amount: "10.50", currency: "USD" },
      { amount: "15000.00", currency: "SYP" },
      { amount: "0.75", currency: "USD" },
      { amount: "500.00", currency: "SYP" },
    ]);
    expect(totals).toEqual([
      { currency: "SYP", amount: "15500.00" },
      { currency: "USD", amount: "11.25" },
    ]);
  });

  it("is exact where floating point is not", () => {
    const totals = sumByCurrency([
      { amount: "0.10", currency: "USD" },
      { amount: "0.20", currency: "USD" },
    ]);
    expect(totals).toEqual([{ currency: "USD", amount: "0.30" }]);
  });

  it("returns nothing for no values and skips bad amounts", () => {
    expect(sumByCurrency([])).toEqual([]);
    expect(sumByCurrency([{ amount: "x", currency: "SYP" }])).toEqual([]);
  });
});
