/**
 * features/brands (الماركات): brand data and its management UI (list, create/edit dialog with
 * logo, delete). The products form reads the same brands through `useBrands`.
 */
export { useBrandList, useDeleteBrand, useBrands, type Brand } from "./api";
export { BrandDialog } from "./components/brand-dialog";
export { BrandFilters } from "./components/brand-filters";
export { BrandsTable } from "./components/brands-table";
export {
  DEFAULT_PARAMS,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  type ListParams,
} from "./list-filters";
