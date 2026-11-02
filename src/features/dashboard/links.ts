import {
  DEFAULT_PARAMS as ORDER_DEFAULTS,
  toSearchParams as orderSearch,
  type OrderStatus,
} from "@/features/orders";
import {
  DEFAULT_PARAMS as PRODUCT_DEFAULTS,
  toSearchParams as productSearch,
} from "@/features/products";

/** The orders list filtered to one status (the list's own URL format, never hand-built). */
export function ordersByStatus(status: OrderStatus): string {
  return `/orders?${orderSearch({ ...ORDER_DEFAULTS, status })}`;
}

/** The products list, lowest stock first: the closest existing view to "low stock". */
export const LOW_STOCK_ALL = `/products?${productSearch({ ...PRODUCT_DEFAULTS, sort: "stock_asc" })}`;

export const productEdit = (id: number) => `/products/${id}/edit`;
