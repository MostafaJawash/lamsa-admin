import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Where a column goes in the stacked-card layout (below `md`): `media` is the thumbnail,
 * `title` the headline, `actions` the button row. Every other column is a labelled field.
 */
export type MobileRole = "media" | "title" | "actions";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  mobile?: MobileRole;
};

type DataTableProps<T> = {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string | number;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Shows skeleton rows instead of data (first load). */
  loading?: boolean;
  skeletonRows?: number;
};

/** One row as a card: the same `cell` renderers as the table, so both layouts show the same data. */
function RowCard<T>({
  columns,
  row,
}: {
  columns: readonly Column<T>[];
  row: T;
}) {
  const media = columns.find((c) => c.mobile === "media");
  const title = columns.find((c) => c.mobile === "title");
  const actions = columns.find((c) => c.mobile === "actions");
  const fields = columns.filter((c) => !c.mobile);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
      {media || title ? (
        <div className="flex items-start gap-3">
          {media ? <div className="shrink-0">{media.cell(row)}</div> : null}
          {title ? (
            <div className="min-w-0 flex-1 text-base break-words [&_a]:inline-flex [&_a]:min-h-11 [&_a]:min-w-11 [&_a]:items-center [&_button]:min-h-11">
              {title.cell(row)}
            </div>
          ) : null}
        </div>
      ) : null}
      {fields.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {fields.map((column) => (
            <div key={column.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-ink-muted">{column.header}</dt>
              <dd className="break-words">{column.cell(row)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-1 border-t border-line pt-2">
          {actions.cell(row)}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Wrapper over the shadcn table: columns are described by data, rows render through `cell`.
 * Sorting and paging belong to the server, so they live in the page, not here.
 * Below `md` the rows become stacked cards built from the same columns (see `MobileRole`);
 * from `md` up it is a table whose actions column stays pinned while the table scrolls.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle,
  emptyMessage,
  loading = false,
  skeletonRows = 8,
}: DataTableProps<T>) {
  const mobile = useIsMobile();
  if (!loading && rows.length === 0)
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  if (mobile)
    return (
      <ul className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 4) }, (_, index) => (
              <li key={index} data-testid="skeleton-row">
                <Skeleton className="h-28 w-full rounded-xl" />
              </li>
            ))
          : rows.map((row) => (
              <RowCard key={rowKey(row)} columns={columns} row={row} />
            ))}
      </ul>
    );
  const pinned = (column: Column<T>) =>
    column.mobile === "actions" ? "sticky end-0 bg-background" : undefined;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(column.className, pinned(column))}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: skeletonRows }, (_, index) => (
              <TableRow key={index} data-testid="skeleton-row">
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.className, pinned(column))}
                  >
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.className, pinned(column))}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
