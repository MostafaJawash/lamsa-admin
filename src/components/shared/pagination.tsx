import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { m } from "@/messages";

type PagerProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/**
 * Pager for the backend's `{items, page, page_size, total}` lists. In RTL "next" points
 * left and "previous" points right, so the chevrons are flipped with `rtl:rotate-180`.
 */
export function Pager({ page, pageSize, total, onPageChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      className="flex items-center justify-between gap-3"
      aria-label={m.common.page}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronRightIcon data-icon="inline-start" className="rtl:rotate-180" />
        {m.common.previous}
      </Button>
      <span className="text-sm text-ink-muted tabular-nums">
        {m.common.page} {page} {m.common.of} {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        {m.common.next}
        <ChevronLeftIcon data-icon="inline-end" className="rtl:rotate-180" />
      </Button>
    </nav>
  );
}
