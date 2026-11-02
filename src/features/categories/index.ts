/**
 * features/categories (الأقسام): the category tree, its attribute and variant-option
 * definitions, and their management UI. The same queries feed the products form (selects,
 * dynamic attribute fields), so every change here invalidates them together.
 *
 * The real model (see README): a two-level tree; attributes and variant options are separate,
 * per-category definitions inherited by child categories (a child's own key wins).
 */
export {
  CATALOG_STALE_MS,
  flattenCategories,
  useCategoryDetail,
  useCategoryForEdit,
  useCategoryTree,
  useDeleteCategory,
  type CategoryAttribute,
  type CategoryDetail,
  type CategoryNode,
  type CategoryOption,
  type CategoryVariantOption,
} from "./api";
export { flattenTree } from "./tree";
export { CategoriesTable } from "./components/categories-table";
export { CategoryForm } from "./components/category-form";
export { CategoryImage } from "./components/category-image";
export {
  AttributesSection,
  VariantOptionsSection,
} from "./components/definitions-sections";
