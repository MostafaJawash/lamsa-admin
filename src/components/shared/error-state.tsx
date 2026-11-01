import type { ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { m } from "@/messages";

type ErrorStateProps = {
  title?: string;
  message: string;
  children?: ReactNode;
};

/** Shown when a page section failed to load. `message` is already Arabic (see errorMessage). */
export function ErrorState({
  title = m.common.errorTitle,
  message,
  children,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border border-danger/40 bg-surface p-10 text-center"
    >
      <TriangleAlertIcon className="size-8 text-danger" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-ink-muted">{message}</p>
      {children}
    </div>
  );
}
