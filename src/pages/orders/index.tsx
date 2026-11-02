import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Pager } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PARAMS,
  OrderFilters,
  OrderStatsStrip,
  OrdersTable,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  useOrders,
  type ListParams,
} from "@/features/orders";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /orders: server-paged list. Page, filters and sort live in the URL, so reload and back work. */
export function OrdersPage() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseListParams(search), [search]);
  const query = useOrders(params);
  const t = m.orders;

  const update = useCallback(
    (change: Partial<ListParams>, resetPage = true) =>
      setSearch((current) =>
        toSearchParams({
          ...parseListParams(current),
          ...change,
          ...(resetPage && !("page" in change) ? { page: 1 } : {}),
        }),
      ),
    [setSearch],
  );

  const data = query.data;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">{t.title}</h1>

      <OrderStatsStrip
        params={params}
        onSelect={(status) => update({ status })}
      />
      <OrderFilters
        params={params}
        onChange={update}
        onClear={() => setSearch(toSearchParams(DEFAULT_PARAMS))}
      />

      {query.isError && !data ? (
        <ErrorState message={errorMessage(query.error)}>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        </ErrorState>
      ) : (
        <>
          <div
            className={
              query.isPlaceholderData ? "opacity-60 transition-opacity" : ""
            }
          >
            <OrdersTable
              rows={data?.items ?? []}
              loading={query.isPending}
              emptyMessage={
                hasActiveFilters(params) ? t.emptyFiltered : t.emptyHint
              }
            />
          </div>
          {data && data.total > PAGE_SIZE ? (
            <Pager
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPageChange={(page) => update({ page }, false)}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
