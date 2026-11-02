import { api, unwrap } from "@/lib/api/client";

import { PAGE_SIZE, type ListParams } from "./list-filters";

/** This page lists customers only: the role is fixed, there is no role filter in the UI. */
export function fetchCustomers(params: ListParams) {
  return unwrap(
    api.GET("/admin/users", {
      params: {
        query: {
          page: params.page,
          page_size: PAGE_SIZE,
          role: "customer",
          search: params.q.trim() || undefined,
          is_active:
            params.status === "all" ? undefined : params.status === "active",
        },
      },
    }),
  );
}

export function fetchCustomer(id: number) {
  return unwrap(
    api.GET("/admin/users/{user_id}", { params: { path: { user_id: id } } }),
  );
}

/** Only `is_active` is ever sent: changing roles is not part of this page. */
export function setCustomerActive(id: number, active: boolean) {
  return unwrap(
    api.PATCH("/admin/users/{user_id}", {
      params: { path: { user_id: id } },
      body: { is_active: active },
    }),
  );
}

export function resetCustomerPassword(id: number) {
  return unwrap(
    api.POST("/admin/users/{user_id}/reset-password", {
      params: { path: { user_id: id } },
    }),
  );
}
