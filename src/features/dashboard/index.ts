/**
 * features/dashboard (لوحة التحكم): the read-only landing page.
 * Three calls on load: GET /admin/orders/stats (stat cards and top products share it),
 * GET /admin/products/low-stock and GET /admin/orders (newest 5).
 */
export { formatRate } from "./format";
export { LowStock } from "./components/low-stock";
export { RecentOrders } from "./components/recent-orders";
export { StatCards } from "./components/stat-cards";
export { TopProducts } from "./components/top-products";
