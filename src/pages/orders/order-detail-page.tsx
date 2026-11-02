import { ArrowRightIcon } from "lucide-react";
import { Link, useParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderDetailView, useOrder } from "@/features/orders";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /orders/:id */
export function OrderDetailPage() {
  const params = useParams();
  const id = /^\d+$/.test(params.id ?? "") ? Number(params.id) : null;
  const query = useOrder(id);
  const t = m.orders.detail;

  let body;
  if (id === null) {
    body = <ErrorState message={t.notFound} />;
  } else if (query.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  } else if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    body = (
      <ErrorState message={notFound ? t.notFound : errorMessage(query.error)}>
        {notFound ? null : (
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        )}
      </ErrorState>
    );
  } else {
    body = <OrderDetailView order={query.data} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/orders"
        className="inline-flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-brand"
      >
        <ArrowRightIcon className="size-4" aria-hidden />
        {t.back}
      </Link>
      {body}
    </section>
  );
}
