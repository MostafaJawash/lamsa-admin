import { describe, expect, it } from "vitest";

import {
  EMPTY_LINK,
  URL_MAX,
  changeLinkType,
  describeLink,
  fromBackendLink,
  takesValue,
  toBackendLink,
  validateLink,
  type LinkValue,
} from "@/features/banners";
import { bannerSchema, EMPTY_BANNER } from "@/features/banners/schema";
import { fromStoreInput, toStoreInput } from "@/lib/dates";

const link = (type: LinkValue["type"], value = ""): LinkValue => ({
  type,
  value,
  label: value,
});

describe("link type to field mapping", () => {
  it("only product, category, brand and url take a value", () => {
    expect(takesValue("product")).toBe(true);
    expect(takesValue("category")).toBe(true);
    expect(takesValue("brand")).toBe(true);
    expect(takesValue("url")).toBe(true);
    expect(takesValue("none")).toBe(false);
    expect(takesValue("new")).toBe(false);
    expect(takesValue("sale")).toBe(false);
  });

  it("changing the type clears the value; the same type keeps it", () => {
    const product = { type: "product", value: "rose", label: "ورد" } as const;
    expect(changeLinkType(product, "brand")).toEqual({
      type: "brand",
      value: "",
      label: "",
    });
    expect(changeLinkType(product, "product")).toBe(product);
  });

  it("sends a null value for the value-less types, even if one is left over", () => {
    expect(toBackendLink(link("none", "stale"))).toEqual({
      type: "none",
      value: null,
    });
    expect(toBackendLink(link("sale", "stale"))).toEqual({
      type: "sale",
      value: null,
    });
    expect(toBackendLink(link("product", " rose-cream "))).toEqual({
      type: "product",
      value: "rose-cream",
    });
  });

  it("reads a saved link back, keeping the slug as the label until resolved", () => {
    expect(fromBackendLink({ type: "brand", value: "lamsa" })).toEqual({
      type: "brand",
      value: "lamsa",
      label: "lamsa",
    });
    expect(fromBackendLink({ type: "weird", value: null })).toEqual(EMPTY_LINK);
  });
});

describe("link validation", () => {
  it("needs no value for none, new and sale", () => {
    for (const type of ["none", "new", "sale"] as const)
      expect(validateLink(link(type))).toBeNull();
  });

  it("requires a chosen target for product, category and brand", () => {
    for (const type of ["product", "category", "brand"] as const) {
      expect(validateLink(link(type))).toBe("اختر الوجهة من القائمة.");
      expect(validateLink(link(type, "x"))).toBeNull();
    }
  });

  it("accepts only https URLs of at most 255 characters", () => {
    expect(validateLink(link("url"))).toBe("أدخل الرابط.");
    expect(validateLink(link("url", "http://example.com"))).toContain("https");
    expect(validateLink(link("url", "javascript:alert(1)"))).toContain("https");
    expect(validateLink(link("url", "https://"))).toContain("https");
    expect(validateLink(link("url", "not a url"))).toContain("https");
    expect(validateLink(link("url", "https://example.com/a?b=1"))).toBeNull();
    const long = `https://example.com/${"a".repeat(URL_MAX)}`;
    expect(validateLink(link("url", long))).toBe("الرابط لا يتجاوز 255 حرفاً.");
  });
});

describe("describeLink", () => {
  const names = (type: string, slug: string) =>
    type === "product" && slug === "rose" ? "كريم الورد" : undefined;

  it("writes a human-readable description per type", () => {
    expect(describeLink({ type: "none" })).toBe("بدون رابط");
    expect(describeLink({ type: "new" })).toBe("قسم الجديد");
    expect(describeLink({ type: "sale" })).toBe("قسم التخفيضات");
    expect(describeLink({ type: "product", value: "rose" }, names)).toBe(
      "منتج: كريم الورد",
    );
    expect(describeLink({ type: "category", value: "skin" }, names)).toBe(
      "قسم: skin",
    );
    expect(describeLink({ type: "brand", value: "lamsa" })).toBe(
      "ماركة: lamsa",
    );
    expect(describeLink({ type: "url", value: "https://a.sy" })).toBe(
      "رابط خارجي: https://a.sy",
    );
  });
});

describe("banner form schema", () => {
  const ok = { ...EMPTY_BANNER, title: "عرض" };
  const issues = (values: unknown) =>
    bannerSchema.safeParse(values).error?.issues.map((i) => i.path[0]);

  it("accepts a minimal banner", () => {
    expect(bannerSchema.safeParse(ok).success).toBe(true);
  });

  it("checks title, subtitle, link and window", () => {
    expect(issues({ ...ok, title: "  " })).toEqual(["title"]);
    expect(issues({ ...ok, title: "ا".repeat(151) })).toEqual(["title"]);
    expect(issues({ ...ok, subtitle: "ا".repeat(256) })).toEqual(["subtitle"]);
    expect(issues({ ...ok, link: link("product") })).toEqual(["link"]);
    expect(
      issues({
        ...ok,
        starts_at: "2026-12-02T10:00",
        ends_at: "2026-12-01T10:00",
      }),
    ).toEqual(["ends_at"]);
    expect(
      bannerSchema.safeParse({
        ...ok,
        starts_at: "2026-12-01T10:00",
        ends_at: "2026-12-02T10:00",
      }).success,
    ).toBe(true);
  });
});

describe("store time inputs", () => {
  it("converts Damascus wall time to UTC and back", () => {
    // Damascus is UTC+3 all year (no daylight saving since 2022).
    expect(fromStoreInput("2026-12-01T10:00")).toBe("2026-12-01T07:00:00Z");
    expect(toStoreInput("2026-12-01T07:00:00Z")).toBe("2026-12-01T10:00");
    expect(toStoreInput("2026-12-01T07:00:00")).toBe("2026-12-01T10:00");
    expect(fromStoreInput(toStoreInput("2026-06-15T21:30:00Z"))).toBe(
      "2026-06-15T21:30:00Z",
    );
    expect(fromStoreInput("")).toBeNull();
  });
});
