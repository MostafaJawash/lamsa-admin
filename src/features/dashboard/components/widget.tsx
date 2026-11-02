import type { ReactNode } from "react";
import { Link } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

type Props = {
  title: string;
  testId: string;
  /** The widget's own query state: each widget loads, fails and retries on its own. */
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  /** Where "عرض الكل" goes; omitted when there is nothing more to show. */
  viewAll?: string;
  skeletonRows?: number;
  children: ReactNode;
};

/** Titled card with independent loading skeleton and error-with-retry states. */
export function Widget({
  title,
  testId,
  query,
  viewAll,
  skeletonRows = 5,
  children,
}: Props) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {viewAll ? (
          <Link
            to={viewAll}
            className="inline-flex text-sm text-brand hover:underline max-md:min-h-11 max-md:items-center"
          >
            {m.dashboard.viewAll}
          </Link>
        ) : null}
      </header>
      {query.isPending ? (
        <div data-testid={`${testId}-loading`} className="flex flex-col gap-2">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)}>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {m.common.retry}
          </Button>
        </ErrorState>
      ) : (
        children
      )}
    </section>
  );
}
