import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type OrderStatus = Schemas["OrderStatus"];
export type OrderSummary = Schemas["AdminOrderSummaryOut"];
export type OrderDetail = Schemas["AdminOrderDetailOut"];
export type OrderItem = Schemas["OrderItemOut"];
export type OrderTotal = Schemas["OrderTotalOut"];
export type OrderStats = Schemas["OrderStats"];
export type OrderSort = Schemas["OrderSort"];
export type DeliveryMethod = Schemas["AdminDeliveryMethodOut"];
