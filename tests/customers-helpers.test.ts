import { describe, expect, it } from "vitest";

import { customerHref } from "@/features/orders/address";
import {
  accountTypeLabel,
  canResetPassword,
  isCustomerAccount,
  phoneDigits,
} from "@/features/customers/labels";
import {
  DEFAULT_PARAMS,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
} from "@/features/customers/list-filters";
import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

describe("account type and role", () => {
  it("labels the two account types", () => {
    expect(accountTypeLabel("phone")).toBe("هاتف وكلمة مرور");
    expect(accountTypeLabel("google")).toBe("حساب Google");
    expect(accountTypeLabel("something-new")).toBe("something-new");
  });
  it("this page manages customers only", () => {
    expect(isCustomerAccount({ role: "customer" })).toBe(true);
    expect(isCustomerAccount({ role: "admin" })).toBe(false);
  });
  it("only a customer's phone account has a password to reset", () => {
    expect(canResetPassword({ role: "customer", auth_provider: "phone" })).toBe(
      true,
    );
    expect(
      canResetPassword({ role: "customer", auth_provider: "google" }),
    ).toBe(false);
    expect(canResetPassword({ role: "admin", auth_provider: "phone" })).toBe(
      false,
    );
  });
  it("takes the digits of an E.164 phone for the orders search", () => {
    expect(phoneDigits("+963933123456")).toBe("963933123456");
    expect(phoneDigits("+96393 312-3456")).toBe("963933123456");
  });
});

describe("customer status labels", () => {
  it("uses 'نشط' and 'معطّل'", () => {
    expect(m.customers.status).toEqual({ active: "نشط", inactive: "معطّل" });
  });
});

describe("list URL state", () => {
  it("defaults when the URL is empty or invalid", () => {
    expect(parseListParams(new URLSearchParams(""))).toEqual(DEFAULT_PARAMS);
    expect(parseListParams(new URLSearchParams("page=-2&status=zzz"))).toEqual(
      DEFAULT_PARAMS,
    );
  });
  it("round-trips page, search and status and leaves defaults out", () => {
    const params = { page: 3, q: "رنا", status: "inactive" as const };
    expect(parseListParams(toSearchParams(params))).toEqual(params);
    expect(toSearchParams(DEFAULT_PARAMS).toString()).toBe("");
    expect(hasActiveFilters(params)).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, page: 2 })).toBe(false);
  });
});

describe("shared helpers reused here", () => {
  it("shows registration dates in Damascus time, like the orders pages", () => {
    expect(formatDateTime("2026-11-01T10:30:00Z")).toBe("01/11/2026 13:30");
  });
  it("links an order's customer to /customers/:id (no longer null)", () => {
    expect(customerHref(42)).toBe("/customers/42");
  });
});
