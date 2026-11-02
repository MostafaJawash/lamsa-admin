/**
 * features/customers (العملاء): customer accounts as the admin API exposes them.
 *
 * The real model (see README): customers and admins share one user table (`role`); this page
 * is scoped to `role=customer`. An admin can activate/deactivate a customer and reset a phone
 * account's password; nothing else about an account is editable. Order history and the
 * address of the latest order are composed in src/pages/customers from the orders feature.
 */
export { useCustomer, useCustomers } from "./api";
export { CustomerActions } from "./components/customer-actions";
export { CustomerFilters } from "./components/customer-filters";
export { CustomerProfile } from "./components/customer-profile";
export { CustomersTable } from "./components/customers-table";
export {
  accountTypeLabel,
  canResetPassword,
  isCustomerAccount,
  phoneDigits,
} from "./labels";
export {
  DEFAULT_PARAMS,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  type ListParams,
} from "./list-filters";
export type { Customer } from "./types";
