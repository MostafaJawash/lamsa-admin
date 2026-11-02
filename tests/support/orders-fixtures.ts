import type { OrderDetail, OrderSummary } from "@/features/orders";

import { urls } from "./backend-mock";

export function orderSummary(over: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 101,
    created_at: "2026-11-01T10:30:00Z",
    status: "pending",
    status_label: "تم استلام طلبك",
    items_count: 2,
    totals: [
      {
        currency: "USD",
        subtotal: "9.00",
        discount: "0.00",
        shipping_fee: "0.00",
        total: "9.00",
        is_legacy: false,
      },
      {
        currency: "SYP",
        subtotal: "40000.00",
        discount: "0.00",
        shipping_fee: "15000.00",
        total: "55000.00",
        is_legacy: false,
      },
    ],
    image: urls,
    delivery_method_name: "توصيل دمشق",
    user_id: 7,
    customer_name: "رنا الأحمد",
    customer_phone: "+963933123456",
    map_url: null,
    ...over,
  } as OrderSummary;
}

const TIMELINE = [
  {
    status: "pending",
    label: "تم استلام طلبك",
    reached_at: "2026-11-01T10:30:00Z",
    is_current: true,
    cancel_reason: null,
  },
  {
    status: "preparing",
    label: "قيد التجهيز",
    reached_at: null,
    is_current: false,
    cancel_reason: null,
  },
  {
    status: "shipped",
    label: "تم الشحن",
    reached_at: null,
    is_current: false,
    cancel_reason: null,
  },
  {
    status: "delivered",
    label: "تم التوصيل",
    reached_at: null,
    is_current: false,
    cancel_reason: null,
  },
];

export function orderDetail(over: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 101,
    created_at: "2026-11-01T10:30:00Z",
    status: "pending",
    status_label: "تم استلام طلبك",
    payment_method: "cod",
    payment_status: "pending",
    delivery: {
      code: "province_shipping",
      name: "شحن إلى المحافظات",
      currency: "SYP",
      fee_paid_to_carrier: true,
    },
    shipping_address: {
      label: "البيت",
      governorate: "aleppo",
      area: "الفرقان",
      details: "قرب الحديقة العامة",
      latitude: "36.2",
      longitude: "37.1",
      notes: "الطابق الثاني",
    },
    customer_notes: "اتصلوا قبل الوصول",
    gift_message: "كل عام وأنتِ بخير",
    items: [
      {
        product_id: 5,
        product_slug: "rose-cream",
        name: "كريم الورد",
        variant_label: "50 ml",
        options: null,
        image: urls,
        currency: "SYP",
        unit_price: "20000.00",
        quantity: 2,
        line_total: "40000.00",
        bundle_contents: null,
      },
      {
        product_id: null,
        product_slug: null,
        name: "عطر الياسمين",
        variant_label: null,
        options: null,
        image: null,
        currency: "USD",
        unit_price: "9.00",
        quantity: 1,
        line_total: "9.00",
        bundle_contents: null,
      },
    ],
    totals: orderSummary().totals,
    timeline: TIMELINE,
    cancel_reason: null,
    can_cancel: true,
    customer: {
      user_id: 7,
      name: "رنا الأحمد",
      phone: "+963933123456",
      orders_count: 3,
    },
    history: [
      {
        from_status: null,
        to_status: "pending",
        changed_by_user_id: 7,
        changed_by_name: "رنا الأحمد",
        note: null,
        created_at: "2026-11-01T10:30:00Z",
      },
    ],
    allowed_next_statuses: ["preparing"],
    map_url: "https://www.google.com/maps?q=36.2,37.1",
    ...over,
  } as OrderDetail;
}

export const governorates = [
  { code: "damascus", name: "دمشق" },
  { code: "aleppo", name: "حلب" },
];

export const deliveryMethods = [
  { id: 1, code: "damascus_courier", name: "توصيل دمشق" },
  { id: 2, code: "province_shipping", name: "شحن إلى المحافظات" },
];

export const emptyStats = {
  date_from: null,
  date_to: null,
  orders_count: 6,
  counts: {
    pending: 3,
    preparing: 2,
    shipped: 1,
    ready_for_pickup: 0,
    delivered: 0,
    cancelled: 0,
  },
  delivered_revenue: [],
  average_order_value: [],
  cancelled_rate: 0,
  top_products: [],
};
