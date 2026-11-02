import { PlusIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { Pager } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PARAMS,
  PAGE_SIZE,
  ProductFilters,
  ProductsTable,
  StockAdjustDialog,
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  useDeleteProduct,
  useProducts,
  type ListParams,
  type ProductListItem,
  type StockTarget,
} from "@/features/products";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /products: server-paged list. Page and filters live in the URL, so reload and back work. */
export function ProductsPage() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseListParams(search), [search]);
  const query = useProducts(params);
  const [deleting, setDeleting] = useState<ProductListItem | null>(null);
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);
  const remove = useDeleteProduct();
  const t = m.products;

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
        const hint =
          error instanceof ApiError &&
          (error.code === "PRODUCT_HAS_ORDERS" ||
            error.code === "PRODUCT_IN_BUNDLE")
            ? ` ${t.delete.inactiveHint}`
            : "";
        toast.error(`${errorMessage(error)}${hint}`);
        setDeleting(null);
      },
    });
  };

  const data = query.data;
  const filtered = hasActiveFilters(params);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <Button asChild>
          <Link to="/products/new">
            <PlusIcon data-icon="inline-start" />
            {t.add}
          </Link>
        </Button>
      </div>

      <ProductFilters
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
            <ProductsTable
              rows={data?.items ?? []}
              loading={query.isPending}
              emptyMessage={filtered ? t.emptyFiltered : t.emptyHint}
              onDelete={setDeleting}
              onAdjustStock={(product) =>
                setStockTarget({
                  productId: product.id,
                  label: product.name,
                  stock: product.stock ?? 0,
                })
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
      <StockAdjustDialog
        target={stockTarget}
        onOpenChange={(open) => !open && setStockTarget(null)}
      />
    </section>
  );
}
