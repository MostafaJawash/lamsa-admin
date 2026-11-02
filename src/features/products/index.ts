/**
 * features/products (المنتجات): the admin product catalog.
 * Query hooks and request functions, the form's zod schema and payload mapping, and the
 * domain components used by src/pages/products.
 */
export { useDeleteProduct, useProduct, useProducts } from "./api";
export { ProductFilters } from "./components/product-filters";
export { ProductForm } from "./components/product-form";
export { ProductsTable } from "./components/products-table";
export {
  StockAdjustDialog,
  type StockTarget,
} from "./components/stock-adjust-dialog";
export {
  DEFAULT_PARAMS,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  type ListParams,
} from "./list-filters";
export type { AdminProduct, ProductListItem } from "./types";
