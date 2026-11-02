import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import {
  BannerDialog,
  BannersTable,
  useBanners,
  useDeleteBanner,
  useReorderBanners,
  useUpdateBanner,
  type Banner,
} from "@/features/banners";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /banners: the flat banner list in display order, with reorder, activate and delete. */
export function BannersPage() {
  const query = useBanners();
  const update = useUpdateBanner();
  const reorder = useReorderBanners();
  const remove = useDeleteBanner();
  const [dialog, setDialog] = useState<Banner | "new" | null>(null);
  const [deleting, setDeleting] = useState<Banner | null>(null);
  const t = m.banners;
  const rows = query.data ?? [];

  const toggle = (banner: Banner) =>
    update.mutate(
      { id: banner.id, body: { is_active: !banner.is_active } },
      {
        onSuccess: () =>
          toast.success(banner.is_active ? t.deactivated : t.activated),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const move = (banner: Banner, direction: -1 | 1) => {
    const ids = rows.map((b) => b.id);
    const from = ids.indexOf(banner.id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    reorder.mutate(ids, {
      onSuccess: () => toast.success(t.reordered),
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t.delete.success);
        setDeleting(null);
      },
      onError: (error) => {
        toast.error(errorMessage(error));
        setDeleting(null);
      },
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <Button onClick={() => setDialog("new")}>
          <PlusIcon data-icon="inline-start" />
          {t.add}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">{t.limitHint}</p>

      {query.isError && !query.data ? (
        <ErrorState message={errorMessage(query.error)}>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        </ErrorState>
      ) : (
        <BannersTable
          rows={rows}
          loading={query.isPending}
          busy={update.isPending || reorder.isPending}
          onEdit={setDialog}
          onDelete={setDeleting}
          onToggle={toggle}
          onMove={move}
        />
      )}

      <BannerDialog banner={dialog} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.delete.title}
        description={`${deleting?.title ?? ""} — ${t.delete.description}`}
        confirmLabel={t.delete.confirm}
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
