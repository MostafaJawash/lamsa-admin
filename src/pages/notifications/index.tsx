import { PlusIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Pager } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PARAMS,
  NotificationFilters,
  NotificationsTable,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  useNotifications,
  type ListParams,
} from "@/features/notifications";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /notifications: history of campaigns (newest first); page and filters live in the URL. */
export function NotificationsPage() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseListParams(search), [search]);
  const query = useNotifications(params);
  const t = m.notifications;

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t.history}</h1>
        <Button asChild>
          <Link to="/notifications/new">
            <PlusIcon data-icon="inline-start" />
            {t.add}
          </Link>
        </Button>
      </div>

      <NotificationFilters
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
            <NotificationsTable
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
