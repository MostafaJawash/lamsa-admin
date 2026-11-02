/**
 * features/categories (الأقسام): the category tree and per-category definitions.
 * Category management pages are a later phase; today products consume this data.
 */
export {
  CATALOG_STALE_MS,
  flattenCategories,
  useCategoryDetail,
  useCategoryTree,
  type CategoryAttribute,
  type CategoryDetail,
  type CategoryNode,
  type CategoryOption,
  type CategoryVariantOption,
} from "./api";
