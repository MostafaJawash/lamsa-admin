import { describe, expect, it } from "vitest";

import { formatRate } from "@/features/dashboard";
import {
  LOW_STOCK_ALL,
  ordersByStatus,
  productEdit,
} from "@/features/dashboard/links";

describe("formatRate", () => {
  it("shows a fraction as a percentage with at most two decimals", () => {
    expect(formatRate(0)).toBe("0٪");
    expect(formatRate(0.0833)).toBe("8.33٪");
    expect(formatRate(0.5)).toBe("50٪");
    expect(formatRate(0.1)).toBe("10٪");
    expect(formatRate(1)).toBe("100٪");
  });

  it("clamps and survives bad input", () => {
    expect(formatRate(-0.2)).toBe("0٪");
    expect(formatRate(3)).toBe("100٪");
    expect(formatRate(Number.NaN)).toBe("0٪");
  });
});

describe("dashboard links", () => {
  it("uses the orders list's own status filter format", () => {
    expect(ordersByStatus("pending")).toBe("/orders?status=pending");
    expect(ordersByStatus("delivered")).toBe("/orders?status=delivered");
  });

  it("links low stock to the products list sorted by stock, and products to their edit page", () => {
    expect(LOW_STOCK_ALL).toBe("/products?sort=stock_asc");
    expect(productEdit(12)).toBe("/products/12/edit");
  });
});
