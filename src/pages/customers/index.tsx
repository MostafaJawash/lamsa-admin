import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Pager } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  CustomerFilters,
  CustomersTable,
  DEFAULT_PARAMS,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  useCustomers,
  type ListParams,
} from "@/features/customers";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /customers: server-paged list of customers; page, search and status live in the URL. */
export function CustomersPage() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseListParams(search), [search]);
  const query = useCustomers(params);
  const t = m.customers;

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

      <CustomerFilters
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
            <CustomersTable
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
