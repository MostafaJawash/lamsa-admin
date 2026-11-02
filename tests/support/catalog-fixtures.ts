import type {
  CategoryAttribute,
  CategoryDetail,
  CategoryNode,
  CategoryVariantOption,
} from "@/features/categories";
import type { Brand } from "@/features/brands";

import { urls } from "./backend-mock";

const base = {
  description: null,
  image: null,
  sort_order: 0,
  is_active: true,
  product_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  children: [],
};

export function categoryNode(
  over: Partial<CategoryNode> & { id: number },
): CategoryNode {
  return {
    ...base,
    name: `قسم ${over.id}`,
    slug: `cat-${over.id}`,
    parent_id: null,
    ...over,
  } as CategoryNode;
}

export const categoryTree: CategoryNode[] = [
  categoryNode({
    id: 1,
    name: "العناية بالبشرة",
    slug: "skin-care",
    product_count: 7,
    image: urls,
    children: [
      categoryNode({
        id: 11,
        name: "الكريمات",
        slug: "creams",
        parent_id: 1,
        product_count: 4,
      }),
      categoryNode({
        id: 12,
        name: "الأمصال",
        slug: "serums",
        parent_id: 1,
        is_active: false,
      }),
    ],
  }),
  categoryNode({ id: 2, name: "العطور", slug: "perfumes", is_active: false }),
];

export function attribute(
  over: Partial<CategoryAttribute> & { id: number },
): CategoryAttribute {
  return {
    category_id: 1,
    key: `attr_${over.id}`,
    label: `خاصية ${over.id}`,
    type: "text",
    options: null,
    unit: null,
    is_required: false,
    is_filterable: false,
    sort_order: 0,
    inherited: false,
    ...over,
  } as CategoryAttribute;
}

export function variantOption(
  over: Partial<CategoryVariantOption> & { id: number },
): CategoryVariantOption {
  return {
    category_id: 1,
    key: `opt_${over.id}`,
    label: `خيار ${over.id}`,
    type: "color",
    options: null,
    sort_order: 0,
    inherited: false,
    ...over,
  } as CategoryVariantOption;
}

export function categoryDetail(
  over: Partial<CategoryDetail> = {},
): CategoryDetail {
  const own = [
    attribute({
      id: 1,
      key: "volume",
      label: "الحجم",
      type: "number",
      unit: "ml",
      is_required: true,
    }),
    attribute({
      id: 2,
      key: "skin_type",
      label: "نوع البشرة",
      type: "select",
      options: ["جافة", "دهنية"],
    }),
  ];
  const opts = [
    variantOption({ id: 1, key: "color", label: "اللون", type: "color" }),
  ];
  return {
    ...base,
    id: 11,
    name: "الكريمات",
    slug: "creams",
    parent_id: 1,
    own_attributes: own,
    own_variant_options: opts,
    effective_attributes: [
      attribute({
        id: 9,
        category_id: 1,
        key: "brand_note",
        label: "ملاحظة الماركة",
        inherited: true,
      }),
      ...own,
    ],
    effective_variant_options: opts,
    ...over,
  } as CategoryDetail;
}

export function brand(over: Partial<Brand> & { id: number }): Brand {
  return {
    name: `ماركة ${over.id}`,
    slug: `brand-${over.id}`,
    description: null,
    logo: null,
    is_own_brand: false,
    is_active: true,
    sort_order: 0,
    product_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as Brand;
}
