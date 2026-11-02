import { ArrowRightIcon } from "lucide-react";
import { Link, useParams } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationDetail, useNotification } from "@/features/notifications";
import { ApiError, errorMessage } from "@/lib/errors";
import { m } from "@/messages";

/** /notifications/:id */
export function NotificationDetailPage() {
  const params = useParams();
  const id = /^\d+$/.test(params.id ?? "") ? Number(params.id) : null;
  const query = useNotification(id);
  const t = m.notifications.detail;

  let body;
  if (id === null) {
    body = <ErrorState message={t.notFound} />;
  } else if (query.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
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
    body = (
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">{query.data.title}</h1>
        <NotificationDetail notification={query.data} />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/notifications"
        className="inline-flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-brand max-md:min-h-11"
      >
        <ArrowRightIcon className="size-4" aria-hidden />
        {t.back}
      </Link>
      {body}
    </section>
  );
}
