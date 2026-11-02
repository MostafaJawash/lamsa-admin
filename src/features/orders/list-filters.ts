import { isOrderStatus } from "./status";
import type { OrderSort, OrderStatus } from "./types";

export const PAGE_SIZE = 20;

export const SORTS: readonly OrderSort[] = ["newest", "oldest", "total_desc"];

/** Everything the orders list keeps in the URL query string. */
export type ListParams = {
  page: number;
  q: string;
  status: OrderStatus | "all";
  /** A delivery method code (e.g. damascus_courier), or "all". */
  delivery: string;
  /** UTC dates, YYYY-MM-DD, inclusive (the backend's rule). */
  from: string;
  to: string;
  sort: OrderSort;
};

export const DEFAULT_PARAMS: ListParams = {
  page: 1,
  q: "",
  status: "all",
  delivery: "all",
  from: "",
  to: "",
  sort: "newest",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[a-z0-9_]{1,30}$/;

export function parseListParams(search: URLSearchParams): ListParams {
  const page = Number(search.get("page"));
  const status = search.get("status");
  const delivery = search.get("delivery") ?? "";
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  const sort = search.get("sort") as OrderSort | null;
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    q: (search.get("q") ?? "").slice(0, 100),
    status: isOrderStatus(status) ? status : "all",
    delivery: CODE.test(delivery) ? delivery : "all",
    from: DATE.test(from) ? from : "",
    to: DATE.test(to) ? to : "",
    sort: sort && SORTS.includes(sort) ? sort : "newest",
  };
}

export function toSearchParams(params: ListParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.page > 1) search.set("page", String(params.page));
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.status !== "all") search.set("status", params.status);
  if (params.delivery !== "all") search.set("delivery", params.delivery);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.sort !== "newest") search.set("sort", params.sort);
  return search;
}

export function hasActiveFilters(params: ListParams): boolean {
  return (
    params.q.trim() !== "" ||
    params.status !== "all" ||
    params.delivery !== "all" ||
    params.from !== "" ||
    params.to !== ""
  );
}
