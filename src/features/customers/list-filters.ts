export const PAGE_SIZE = 20;

export type StatusFilter = "all" | "active" | "inactive";

/**
 * Everything the customers list keeps in the URL. The backend lists newest first and has no
 * other sort, and `search` matches part of the name or phone (not the email).
 */
export type ListParams = { page: number; q: string; status: StatusFilter };

export const DEFAULT_PARAMS: ListParams = { page: 1, q: "", status: "all" };

export function parseListParams(search: URLSearchParams): ListParams {
  const page = Number(search.get("page"));
  const status = search.get("status");
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    q: (search.get("q") ?? "").slice(0, 100),
    status: status === "active" || status === "inactive" ? status : "all",
  };
}

export function toSearchParams(params: ListParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.page > 1) search.set("page", String(params.page));
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.status !== "all") search.set("status", params.status);
  return search;
}

export function hasActiveFilters(params: ListParams): boolean {
  return params.q.trim() !== "" || params.status !== "all";
}
