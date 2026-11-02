import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import {
  CategoriesTable,
  useCategoryTree,
  useDeleteCategory,
  type CategoryNode,
} from "@/features/categories";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** The `{children, products}` counts of a CATEGORY_NOT_EMPTY refusal, as text. */
function notEmptyCounts(error: unknown): string {
  if (!(error instanceof ApiError) || error.code !== "CATEGORY_NOT_EMPTY")
    return "";
  const d = (error.details ?? {}) as { children?: unknown; products?: unknown };
  const t = m.categories.delete;
  const parts = [
    typeof d.children === "number" && d.children > 0
      ? `${t.children}: ${d.children}`
      : "",
    typeof d.products === "number" && d.products > 0
      ? `${t.products}: ${d.products}`
      : "",
  ].filter(Boolean);
  return parts.length ? ` (${parts.join("، ")})` : "";
}

/** /categories: the category tree. */
export function CategoriesPage() {
  const query = useCategoryTree();
  const remove = useDeleteCategory();
  const [deleting, setDeleting] = useState<CategoryNode | null>(null);
  const t = m.categories;

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t.delete.success);
        setDeleting(null);
      },
      onError: (error) => {
        // The backend's message already says to deactivate instead; add the counts.
        toast.error(`${errorMessage(error)}${notEmptyCounts(error)}`);
        setDeleting(null);
      },
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <Button asChild>
          <Link to="/categories/new">
            <PlusIcon data-icon="inline-start" />
            {t.add}
          </Link>
        </Button>
      </div>
      <p className="text-sm text-ink-muted">{t.productsHint}</p>

      {query.isError && !query.data ? (
        <ErrorState message={errorMessage(query.error)}>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        </ErrorState>
      ) : (
        <CategoriesTable
          nodes={query.data ?? []}
          loading={query.isPending}
          onDelete={setDeleting}
        />
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
    </section>
  );
}
