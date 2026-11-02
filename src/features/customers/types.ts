import type { components } from "@/lib/api/schema";

/** `GET /admin/users` row / detail: profile plus `is_active`, `last_login_at`, `orders_count`. */
export type Customer = components["schemas"]["AdminUserOut"];
export type TemporaryPassword = components["schemas"]["TemporaryPasswordOut"];
