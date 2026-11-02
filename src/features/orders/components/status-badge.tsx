import { cn } from "@/lib/utils";

import { TONE_CLASSES, statusLabel, statusTone } from "../status";

type Props = {
  status: string;
  /** The backend's `status_label` (it knows pickup wording); falls back to our label. */
  label?: string;
  className?: string;
};

/** A colored status pill: neutral new, amber preparing, brand shipped, green delivered, red cancelled. */
export function StatusBadge({ status, label, className }: Props) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[statusTone(status)],
        className,
      )}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}
