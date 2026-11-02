import { describe, expect, it } from "vitest";

import { describeAddress, customerHref } from "@/features/orders/address";
import {
  DEFAULT_PARAMS,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
} from "@/features/orders/list-filters";
import { cancelSchema, statusChangeSchema } from "@/features/orders/schema";
import {
  STATUSES,
  isPickupOrder,
  nextActions,
  statusLabel,
  statusTone,
} from "@/features/orders/status";
import {
  hasDiscount,
  sortedTotals,
  totalLines,
} from "@/features/orders/totals";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import { orderSummary } from "./support/orders-fixtures";

describe("nextActions (what the backend allows next)", () => {
  it("offers exactly the allowed step, with its Arabic action label", () => {
    expect(nextActions(["preparing"], false)).toEqual([
      { to: "preparing", label: "بدء التجهيز" },
    ]);
    expect(nextActions(["shipped"], false)).toEqual([
      { to: "shipped", label: "تم الشحن" },
    ]);
    expect(nextActions(["delivered"], false)).toEqual([
      { to: "delivered", label: "تم التوصيل" },
    ]);
  });
  it("words the last step of a pickup order as received", () => {
    expect(nextActions(["ready_for_pickup"], true)).toEqual([
      { to: "ready_for_pickup", label: "جاهز للاستلام" },
    ]);
    expect(nextActions(["delivered"], true)[0]?.label).toBe("تم الاستلام");
  });
  it("offers nothing for final orders", () => {
    expect(nextActions([], false)).toEqual([]);
  });
  it("never turns cancelling or unknown values into a status button", () => {
    expect(nextActions(["cancelled", "weird"], false)).toEqual([]);
  });
  it("tells pickup orders from delivery orders by the missing address, as the backend does", () => {
    expect(isPickupOrder({ shipping_address: null })).toBe(true);
    expect(isPickupOrder({ shipping_address: { governorate: "aleppo" } })).toBe(
      false,
    );
  });
});

describe("status labels and badge tones", () => {
  it("labels every status with the backend's text", () => {
    expect(STATUSES.map(statusLabel)).toEqual([
      "تم استلام طلبك",
      "قيد التجهيز",
      "تم الشحن",
      "جاهز للاستلام",
      "تم التوصيل",
      "ملغى",
    ]);
  });
  it("gives each stage its own tone: neutral, warn, brand, gold, ok, danger", () => {
    expect(STATUSES.map(statusTone)).toEqual([
      "neutral",
      "warn",
      "brand",
      "gold",
      "ok",
      "danger",
    ]);
    expect(statusTone("something-new")).toBe("neutral");
    expect(statusLabel("something-new")).toBe("something-new");
  });
});

describe("multi-currency totals", () => {
  const totals = orderSummary().totals;
  it("lists one amount per currency, SYP first, never summed", () => {
    const lines = totalLines(totals);
    expect(lines).toEqual([
      { currency: "SYP", amount: "55000.00" },
      { currency: "USD", amount: "9.00" },
    ]);
    expect(lines.map((l) => formatMoney(l.amount, l.currency))).toEqual([
      "55,000 ل.س",
      "9 $",
    ]);
  });
  it("keeps the backend's per-currency rows intact", () => {
    expect(sortedTotals(totals).map((row) => row.currency)).toEqual([
      "SYP",
      "USD",
    ]);
  });
  it("keeps a legacy EUR row, after SYP and USD", () => {
    const legacy = {
      ...totals[0],
      currency: "EUR",
      total: "20.00",
      is_legacy: true,
    } as (typeof totals)[number];
    expect(totalLines([legacy, ...totals]).map((l) => l.currency)).toEqual([
      "SYP",
      "USD",
      "EUR",
    ]);
    expect(formatMoney("20.00", "EUR")).toBe("20.00 €");
  });
  it("shows a discount row only when it is not zero", () => {
    expect(hasDiscount(totals[0]!)).toBe(false);
    expect(hasDiscount({ ...totals[0]!, discount: "5.00" })).toBe(true);
  });
});

describe("address snapshot", () => {
  const name = (code: string) => ({ aleppo: "حلب" })[code as "aleppo"] ?? code;
  it("reads the Syria-era shape with the governorate's Arabic name", () => {
    expect(
      describeAddress(
        {
          label: "البيت",
          governorate: "aleppo",
          area: "الفرقان",
          details: "قرب الحديقة",
          latitude: "36.2",
          longitude: "37.1",
          notes: "ن",
        },
        name,
      ),
    ).toEqual({
      lines: ["البيت", "حلب، الفرقان", "قرب الحديقة"],
      notes: "ن",
      hasLocation: true,
    });
  });
  it("falls back to the code for an unknown governorate and has no location without coordinates", () => {
    const view = describeAddress(
      {
        governorate: "atlantis",
        details: "x",
        latitude: null,
        longitude: null,
      },
      name,
    );
    expect(view?.lines).toEqual(["atlantis", "x"]);
    expect(view?.hasLocation).toBe(false);
  });
  it("reads the historical city/street/building shape and returns null for pickup", () => {
    expect(
      describeAddress({ city: "دمشق", street: "الحمرا", building: "5" }, name)
        ?.lines,
    ).toEqual(["دمشق", "الحمرا", "5"]);
    expect(describeAddress(null, name)).toBeNull();
  });
  it("links an order's customer to their page (the placeholder returned null)", () => {
    expect(customerHref(7)).toBe("/customers/7");
    expect(customerHref(12345)).toBe("/customers/12345");
    expect(customerHref(7)).not.toBeNull();
  });
});

describe("list URL state", () => {
  it("defaults when the URL is empty or invalid", () => {
    expect(parseListParams(new URLSearchParams(""))).toEqual(DEFAULT_PARAMS);
    expect(
      parseListParams(
        new URLSearchParams(
          "page=0&status=bogus&sort=x&from=yesterday&delivery=Bad Code",
        ),
      ),
    ).toEqual(DEFAULT_PARAMS);
  });
  it("round-trips every filter and leaves defaults out", () => {
    const params = {
      page: 2,
      q: "0933",
      status: "shipped" as const,
      delivery: "damascus_courier",
      from: "2026-10-01",
      to: "2026-10-31",
      sort: "total_desc" as const,
    };
    expect(parseListParams(toSearchParams(params))).toEqual(params);
    expect(toSearchParams(DEFAULT_PARAMS).toString()).toBe("");
    expect(hasActiveFilters(params)).toBe(true);
    expect(
      hasActiveFilters({ ...DEFAULT_PARAMS, page: 3, sort: "oldest" }),
    ).toBe(false);
  });
});

describe("forms and dates", () => {
  it("requires a cancel reason of 3 to 255 characters", () => {
    expect(
      cancelSchema.safeParse({ reason: "  ab ", restoreStock: true }).success,
    ).toBe(false);
    expect(
      cancelSchema.safeParse({ reason: "abc", restoreStock: true }).success,
    ).toBe(true);
    expect(
      cancelSchema.safeParse({ reason: "x".repeat(256), restoreStock: true })
        .success,
    ).toBe(false);
  });
  it("limits the status note to 255 characters", () => {
    expect(statusChangeSchema.safeParse({ note: "" }).success).toBe(true);
    expect(
      statusChangeSchema.safeParse({ note: "x".repeat(256) }).success,
    ).toBe(false);
  });
  it("shows backend UTC times in Damascus time (UTC+3 in winter and summer since 2022)", () => {
    expect(formatDateTime("2026-11-01T10:30:00Z")).toBe("01/11/2026 13:30");
    expect(formatDateTime("2026-11-01T10:30:00")).toBe("01/11/2026 13:30");
    expect(formatDateTime("not a date")).toBe("not a date");
  });
});
