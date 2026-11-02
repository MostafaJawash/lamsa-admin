import type { ProductType } from "./types";

export const PAGE_SIZE = 20;

export const SORTS = [
  "newest",
  "name",
  "price_asc",
  "price_desc",
  "stock_asc",
] as const;
export type ProductSort = (typeof SORTS)[number];

export type StatusFilter = "all" | "active" | "inactive";
export type TypeFilter = "all" | ProductType;

/** Everything the products list keeps in the URL query string. */
export type ListParams = {
  page: number;
  q: string;
  category: number | null;
  brand: number | null;
  status: StatusFilter;
  type: TypeFilter;
  sort: ProductSort;
};

export const DEFAULT_PARAMS: ListParams = {
  page: 1,
  q: "",
  category: null,
  brand: null,
  status: "all",
  type: "all",
  sort: "newest",
};

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

/** Reads the list state from the URL; anything invalid falls back to the default. */
export function parseListParams(search: URLSearchParams): ListParams {
  const status = search.get("status");
  const type = search.get("type");
  const sort = search.get("sort");
  return {
    page: positiveInt(search.get("page")) ?? 1,
    q: (search.get("q") ?? "").slice(0, 200),
    category: positiveInt(search.get("category")),
    brand: positiveInt(search.get("brand")),
    status: status === "active" || status === "inactive" ? status : "all",
    type:
      type === "simple" || type === "variable" || type === "bundle"
        ? type
        : "all",
    sort: (SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as ProductSort)
      : "newest",
  };
}

/** Writes the list state to a query string, leaving defaults out so URLs stay short. */
export function toSearchParams(params: ListParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.page > 1) search.set("page", String(params.page));
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.category !== null) search.set("category", String(params.category));
  if (params.brand !== null) search.set("brand", String(params.brand));
  if (params.status !== "all") search.set("status", params.status);
  if (params.type !== "all") search.set("type", params.type);
  if (params.sort !== "newest") search.set("sort", params.sort);
  return search;
}

export function hasActiveFilters(params: ListParams): boolean {
  return (
    params.q.trim() !== "" ||
    params.category !== null ||
    params.brand !== null ||
    params.status !== "all" ||
    params.type !== "all"
  );
}
