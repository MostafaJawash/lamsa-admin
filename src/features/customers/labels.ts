import { m } from "@/messages";

import type { Customer } from "./types";

/** "phone" (phone + password) or "google". */
export function accountTypeLabel(provider: string): string {
  return m.customers.accountTypes[provider] ?? provider;
}

/** This page manages customers only; admin accounts are not managed here. */
export function isCustomerAccount(user: Pick<Customer, "role">): boolean {
  return user.role === "customer";
}

/** Only phone accounts have a password the store can reset (Google accounts do not). */
export function canResetPassword(
  user: Pick<Customer, "role" | "auth_provider">,
): boolean {
  return isCustomerAccount(user) && user.auth_provider === "phone";
}

/**
 * The digits of an E.164 phone ("+963933123456" -> "963933123456"). The orders search
 * matches them against the phone stored on each order, which is how a customer's orders
 * are found (the backend has no customer filter for orders).
 */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
