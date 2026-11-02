/**
 * features/orders (الطلبات): the admin order workflow.
 * Query hooks and request functions, URL list state, the status/address/totals helpers and
 * the components used by src/pages/orders. The backend's workflow is documented in
 * `status.ts` and in the README.
 */
export { useOrder, useOrders } from "./api";
export { OrderDetailView } from "./components/order-detail-view";
export { OrderFilters } from "./components/order-filters";
export { OrderStatsStrip } from "./components/order-stats-strip";
export { OrdersTable } from "./components/orders-table";
export {
  DEFAULT_PARAMS,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  type ListParams,
} from "./list-filters";
export type { OrderDetail, OrderStatus, OrderSummary } from "./types";
