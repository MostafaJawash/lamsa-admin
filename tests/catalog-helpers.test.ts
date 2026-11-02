import { describe, expect, it } from "vitest";

import { flattenCategories, type CategoryNode } from "@/features/categories";
import {
  ATTRIBUTE_TYPES,
  attributeNeedsOptions,
  cleanOptions,
  controlFor,
  hasDuplicates,
  inUseDetails,
  isValidKey,
  productsInUse,
} from "@/features/categories/definitions";
import {
  buildAttributeSchema,
  buildOptionSchema,
  categorySchema,
  EMPTY_CATEGORY,
} from "@/features/categories/schema";
import {
  canHaveParent,
  findNode,
  flattenTree,
  parentOptions,
} from "@/features/categories/tree";
import { brandSchema, EMPTY_BRAND } from "@/features/brands/schema";
import {
  DEFAULT_PARAMS,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
} from "@/features/brands/list-filters";
import { ApiError } from "@/lib/errors";
import { applyFieldErrors } from "@/lib/form-errors";
import { checkImageFile } from "@/lib/image-files";
import { hasNonLatinLetters, isValidSlug, suggestSlug } from "@/lib/slug";

describe("slug", () => {
  it("accepts the backend's format and nothing else", () => {
    for (const ok of ["ab", "face-cream", "a1-b2-c3", "x".repeat(120)])
      expect(isValidSlug(ok)).toBe(true);
    for (const bad of [
      "",
      "a",
      "Face",
      "face_cream",
      "-face",
      "face-",
      "a--b",
      "كريم",
      "x".repeat(121),
    ])
      expect(isValidSlug(bad)).toBe(false);
  });
  it("suggests a slug from a latin name", () => {
    expect(suggestSlug("Face Cream")).toBe("face-cream");
    expect(suggestSlug("  L'Oréal Paris! ")).toBe("l-oreal-paris");
    expect(suggestSlug("Serum 30 ml")).toBe("serum-30-ml");
  });
  it("leaves Arabic names to the backend (empty suggestion)", () => {
    expect(suggestSlug("كريم الورد")).toBe("");
    expect(suggestSlug("")).toBe("");
    expect(suggestSlug("a")).toBe("");
    expect(hasNonLatinLetters("كريم الورد")).toBe(true);
    expect(hasNonLatinLetters("Face Cream 2")).toBe(false);
  });
  it("never suggests more than 120 characters or a trailing dash", () => {
    const slug = suggestSlug(`${"word ".repeat(40)}`);
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(isValidSlug(slug)).toBe(true);
  });
});

const node = (over: Partial<CategoryNode> & { id: number }): CategoryNode =>
  ({
    name: `c${over.id}`,
    slug: `c${over.id}`,
    parent_id: null,
    description: null,
    image: null,
    sort_order: 0,
    is_active: true,
    product_count: 0,
    children: [],
    ...over,
  }) as CategoryNode;

const tree = [
  node({
    id: 1,
    name: "العناية بالبشرة",
    product_count: 5,
    children: [
      node({ id: 11, name: "الكريمات", parent_id: 1, product_count: 3 }),
      node({ id: 12, name: "الأمصال", parent_id: 1, is_active: false }),
    ],
  }),
  node({
    id: 2,
    name: "العطور",
    is_active: false,
    children: [node({ id: 21, name: "رجالي", parent_id: 2 })],
  }),
  node({ id: 3, name: "المكياج" }),
];

describe("category tree", () => {
  it("flattens into parent rows followed by their indented children", () => {
    const rows = flattenTree(tree);
    expect(rows.map((r) => [r.node.id, r.depth])).toEqual([
      [1, 0],
      [11, 1],
      [12, 1],
      [2, 0],
      [21, 1],
      [3, 0],
    ]);
    expect(rows.find((r) => r.node.id === 11)?.parentName).toBe(
      "العناية بالبشرة",
    );
    expect(rows.find((r) => r.node.id === 1)?.parentName).toBeNull();
  });
  it("marks categories hidden from the store (inactive, or inside an inactive parent)", () => {
    const hidden = Object.fromEntries(
      flattenTree(tree).map((r) => [r.node.id, r.hidden]),
    );
    expect(hidden).toEqual({
      1: false,
      11: false,
      12: true,
      2: true,
      21: true,
      3: false,
    });
  });
  it("offers only top-level categories as a parent, never the category itself", () => {
    expect(parentOptions(tree, null).map((o) => o.id)).toEqual([1, 2, 3]);
    expect(parentOptions(tree, 3).map((o) => o.id)).toEqual([1, 2]);
    expect(parentOptions(tree, 11).map((o) => o.id)).toEqual([1, 2, 3]);
    expect(parentOptions(tree, 2).find((o) => o.id === 2)).toBeUndefined();
    expect(parentOptions(tree, null).find((o) => o.id === 2)?.inactive).toBe(
      true,
    );
  });
  it("never lists a child as a parent, so two levels (and no cycles) are kept", () => {
    const ids = parentOptions(tree, null).map((o) => o.id);
    expect(ids).not.toContain(11);
    expect(ids).not.toContain(21);
  });
  it("knows a category with children cannot move under another", () => {
    expect(canHaveParent(findNode(tree, 1))).toBe(false);
    expect(canHaveParent(findNode(tree, 11))).toBe(true);
    expect(canHaveParent(findNode(tree, 3))).toBe(true);
    expect(findNode(tree, 21)?.name).toBe("رجالي");
    expect(findNode(tree, 99)).toBeUndefined();
  });
  it("flags inactive categories for the products form's select", () => {
    const options = flattenCategories(tree);
    const flag = (id: number) => options.find((o) => o.id === id)?.inactive;
    expect(flag(1)).toBe(false);
    expect(flag(12)).toBe(true);
    expect(flag(21)).toBe(true); // active child of an inactive parent
    expect(options.find((o) => o.id === 11)?.label).toBe(
      "العناية بالبشرة ‹ الكريمات",
    );
  });
});

describe("definition helpers", () => {
  it("knows which attribute types need a list of options", () => {
    expect(ATTRIBUTE_TYPES.filter(attributeNeedsOptions)).toEqual([
      "select",
      "multiselect",
    ]);
  });
  it("maps each attribute type to the control the product form renders", () => {
    expect(ATTRIBUTE_TYPES.map(controlFor)).toEqual([
      "text",
      "number",
      "select",
      "multiselect",
      "checkbox",
      "date",
    ]);
  });
  it("validates definition keys like the backend", () => {
    for (const ok of ["color", "size_ml", "a1", "x".repeat(50)])
      expect(isValidKey(ok)).toBe(true);
    for (const bad of [
      "",
      "a",
      "Color",
      "1abc",
      "has-dash",
      "x".repeat(51),
      "لون",
    ])
      expect(isValidKey(bad)).toBe(false);
  });
  it("cleans and checks option lists", () => {
    expect(cleanOptions([" أحمر ", "", "  ", "أزرق"])).toEqual([
      "أحمر",
      "أزرق",
    ]);
    expect(hasDuplicates(["a", "b", "a"])).toBe(true);
    expect(hasDuplicates(["a", "b"])).toBe(false);
  });
  it("reads the context of an 'in use' refusal", () => {
    const attr = new ApiError(409, "ATTRIBUTE_IN_USE", "x", {
      key: "volume",
      products_count: 3,
    });
    expect(productsInUse(attr)).toBe(3);
    expect(inUseDetails(attr)).toBe("volume (3)");
    expect(
      inUseDetails(
        new ApiError(409, "OPTION_IN_USE", "x", {
          value: "50",
          products_count: 2,
        }),
      ),
    ).toBe("50 (2)");
    expect(
      inUseDetails(
        new ApiError(409, "VARIANT_OPTION_IN_USE", "x", {
          key: "color",
          variants_count: 4,
        }),
      ),
    ).toBe("color (4)");
    expect(
      productsInUse(
        new ApiError(409, "OPTION_IN_USE", "x", { products_count: 1 }),
      ),
    ).toBeNull();
    expect(inUseDetails(new Error("boom"))).toBe("");
  });
});

describe("category form schema", () => {
  const run = (over: Partial<typeof EMPTY_CATEGORY>) => {
    const result = categorySchema.safeParse({
      ...EMPTY_CATEGORY,
      name: "قسم",
      ...over,
    });
    const errors: Record<string, string> = {};
    if (!result.success)
      for (const i of result.error.issues) errors[i.path.join(".")] = i.message;
    return errors;
  };
  it("needs a name of at most 100 characters", () => {
    expect(run({ name: "  " }).name).toBeTruthy();
    expect(run({ name: "ا".repeat(101) }).name).toBeTruthy();
    expect(run({})).toEqual({});
  });
  it("validates the slug only when given", () => {
    expect(run({ slug: "" })).toEqual({});
    expect(run({ slug: "face-cream" })).toEqual({});
    expect(run({ slug: "Face Cream" }).slug).toBeTruthy();
  });
  it("limits description and checks the sort order", () => {
    expect(run({ description: "x".repeat(5001) }).description).toBeTruthy();
    expect(run({ sort_order: "abc" }).sort_order).toBeTruthy();
    expect(run({ sort_order: "1000001" }).sort_order).toBeTruthy();
    expect(run({ sort_order: "-5" })).toEqual({});
  });
});

describe("attribute and option dialog schemas", () => {
  const attr = (over: object, editing = false) => {
    const result = buildAttributeSchema(editing).safeParse({
      key: "volume",
      label: "الحجم",
      type: "text",
      options: [],
      unit: "",
      is_required: false,
      is_filterable: false,
      sort_order: "0",
      ...over,
    });
    const errors: Record<string, string> = {};
    if (!result.success)
      for (const i of result.error.issues) errors[i.path.join(".")] = i.message;
    return errors;
  };
  it("checks key (create only), label, unit and sort order", () => {
    expect(attr({})).toEqual({});
    expect(attr({ key: "Bad Key" }).key).toBeTruthy();
    expect(attr({ key: "Bad Key" }, true)).toEqual({});
    expect(attr({ label: " " }).label).toBeTruthy();
    expect(attr({ unit: "x".repeat(21) }).unit).toBeTruthy();
    expect(attr({ sort_order: "1.5" }).sort_order).toBeTruthy();
  });
  it("requires unique, non-empty options for select and multiselect only", () => {
    expect(attr({ type: "select", options: [] }).options).toBeTruthy();
    expect(attr({ type: "select", options: ["", " "] }).options).toBeTruthy();
    expect(
      attr({ type: "multiselect", options: ["a", "a"] }).options,
    ).toBeTruthy();
    expect(attr({ type: "select", options: ["a", "b"] })).toEqual({});
    expect(attr({ type: "number", options: [] })).toEqual({});
  });
  const option = (over: object) => {
    const result = buildOptionSchema(false).safeParse({
      key: "color",
      label: "اللون",
      type: "color",
      options: [],
      sort_order: "0",
      ...over,
    });
    const errors: Record<string, string> = {};
    if (!result.success)
      for (const i of result.error.issues) errors[i.path.join(".")] = i.message;
    return errors;
  };
  it("lets a color option have no list and a select option's list be empty or unique", () => {
    expect(option({})).toEqual({});
    expect(option({ type: "select", options: [] })).toEqual({});
    expect(
      option({ type: "select", options: ["S", "M", "S"] }).options,
    ).toBeTruthy();
    expect(option({ key: "9x" }).key).toBeTruthy();
  });
});

describe("brand schema and list state", () => {
  it("validates the brand form like the backend", () => {
    const run = (over: object) =>
      brandSchema.safeParse({ ...EMPTY_BRAND, name: "ماركة", ...over });
    expect(run({}).success).toBe(true);
    expect(run({ name: "" }).success).toBe(false);
    expect(run({ name: "x".repeat(101) }).success).toBe(false);
    expect(run({ slug: "Bad Slug" }).success).toBe(false);
    expect(run({ description: "x".repeat(5001) }).success).toBe(false);
  });
  it("keeps page, search and status in the URL", () => {
    expect(parseListParams(new URLSearchParams("page=0&status=zzz"))).toEqual(
      DEFAULT_PARAMS,
    );
    const params = { page: 3, q: "لمسة", status: "inactive" as const };
    expect(parseListParams(toSearchParams(params))).toEqual(params);
    expect(toSearchParams(DEFAULT_PARAMS).toString()).toBe("");
    expect(hasActiveFilters(params)).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, page: 2 })).toBe(false);
  });
});

describe("shared helpers", () => {
  it("checks image files like the backend", () => {
    expect(checkImageFile({ type: "image/png", size: 100 })).toBe("ok");
    expect(checkImageFile({ type: "image/gif", size: 100 })).toBe("type");
    expect(
      checkImageFile({ type: "image/webp", size: 5 * 1024 * 1024 + 1 }),
    ).toBe("size");
  });
  it("maps backend errors to form fields", () => {
    const calls: [string, string][] = [];
    const setError = ((field: string, e: { message?: string }) => {
      calls.push([field, e.message ?? ""]);
    }) as never;
    const options = {
      fields: ["name", "slug"],
      codeFields: { SLUG_TAKEN: "slug" },
    };
    expect(
      applyFieldErrors(
        new ApiError(422, "VALIDATION_ERROR", "x", [
          { field: "name", message: "too long" },
          { field: "other", message: "elsewhere" },
        ]),
        setError,
        options,
      ),
    ).toEqual(["elsewhere"]);
    expect(
      applyFieldErrors(
        new ApiError(409, "SLUG_TAKEN", "الرابط مستخدم"),
        setError,
        options,
      ),
    ).toEqual([]);
    expect(
      applyFieldErrors(
        new ApiError(500, "INTERNAL_ERROR", "عطل"),
        setError,
        options,
      ),
    ).toEqual(["عطل"]);
    expect(calls).toEqual([
      ["name", "too long"],
      ["slug", "الرابط مستخدم"],
    ]);
  });
});
