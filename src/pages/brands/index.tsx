import { PlusIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { Pager } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  BrandDialog,
  BrandFilters,
  BrandsTable,
  DEFAULT_PARAMS,
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  useBrandList,
  useDeleteBrand,
  type Brand,
  type ListParams,
} from "@/features/brands";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** The `{products}` count of a BRAND_HAS_PRODUCTS refusal, as text. */
function productsCount(error: unknown): string {
  if (!(error instanceof ApiError) || error.code !== "BRAND_HAS_PRODUCTS")
    return "";
  const count = (error.details as { products?: unknown } | null)?.products;
  return typeof count === "number"
    ? ` (${m.brands.delete.products}: ${count})`
    : "";
}

/** /brands: server-paged list; page, search and status live in the URL. */
export function BrandsPage() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseListParams(search), [search]);
  const query = useBrandList(params);
  const remove = useDeleteBrand();
  const [dialog, setDialog] = useState<Brand | "new" | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const t = m.brands;

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

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t.delete.success);
        setDeleting(null);
      },
      onError: (error) => {
        // The backend's message already says to deactivate instead; add the count.
        toast.error(`${errorMessage(error)}${productsCount(error)}`);
        setDeleting(null);
      },
    });
  };

  const data = query.data;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <Button onClick={() => setDialog("new")}>
          <PlusIcon data-icon="inline-start" />
          {t.add}
        </Button>
      </div>

      <BrandFilters
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
            <BrandsTable
              rows={data?.items ?? []}
              loading={query.isPending}
              emptyMessage={
                hasActiveFilters(params) ? t.emptyFiltered : t.emptyHint
              }
              onEdit={setDialog}
              onDelete={setDeleting}
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

      <BrandDialog brand={dialog} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.delete.title}
        description={`${deleting?.name ?? ""} — ${t.delete.description}`}
        confirmLabel={t.delete.confirm}
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
