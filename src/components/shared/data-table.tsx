import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
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

/**
 * Wrapper over the shadcn table: columns are described by data, rows render through `cell`.
 * Sorting and paging belong to the server, so they live in the page, not here.
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
  if (!loading && rows.length === 0)
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
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
                  <TableCell key={column.key} className={column.className}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
