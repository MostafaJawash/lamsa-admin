import type { components } from "@/lib/api/schema";

export const PAGE_SIZE = 20;

export type NotificationStatus = components["schemas"]["NotificationStatus"];
export type Audience = components["schemas"]["NotificationTarget"];

export const STATUSES: readonly NotificationStatus[] = [
  "queued",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
];
export const AUDIENCES: readonly Audience[] = ["all", "user"];

/**
 * What the history keeps in the URL. The backend lists campaigns (marketing and one-customer
 * messages) newest first; the status and audience filters are the real ones it offers.
 */
export type ListParams = {
  page: number;
  status: NotificationStatus | "all";
  audience: Audience | "all";
};

export const DEFAULT_PARAMS: ListParams = {
  page: 1,
  status: "all",
  audience: "all",
};

export function parseListParams(search: URLSearchParams): ListParams {
  const page = Number(search.get("page"));
  const status = search.get("status");
  const audience = search.get("audience");
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    status: STATUSES.find((s) => s === status) ?? "all",
    audience: AUDIENCES.find((a) => a === audience) ?? "all",
  };
}

export function toSearchParams(params: ListParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.page > 1) search.set("page", String(params.page));
  if (params.status !== "all") search.set("status", params.status);
  if (params.audience !== "all") search.set("audience", params.audience);
  return search;
}

export function hasActiveFilters(params: ListParams): boolean {
  return params.status !== "all" || params.audience !== "all";
}
