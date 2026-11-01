import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";

import { m } from "@/messages";

type EmptyStateProps = {
  title?: string;
  message?: string;
  children?: ReactNode;
};

/** Shown when a list or table has nothing to display. */
export function EmptyState({
  title = m.common.emptyTitle,
  message = m.common.emptyHint,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <InboxIcon className="size-8 text-ink-muted" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-ink-muted">{message}</p>
      {children}
    </div>
  );
}
