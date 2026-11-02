import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/dates";
import { m } from "@/messages";

import { TONE_CLASSES, statusLabel, statusTone } from "../status";
import type { OrderDetail } from "../types";

type Props = { order: OrderDetail };

/** The backend's `timeline` (every workflow step, reached or not) as a vertical list. */
export function OrderTimeline({ order }: Props) {
  const t = m.orders.detail;
  return (
    <ol className="flex flex-col">
      {order.timeline.map((step, index) => {
        const reached = step.reached_at !== null;
        const last = index === order.timeline.length - 1;
        return (
          <li
            key={step.status}
            data-status={step.status}
            aria-current={step.is_current ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {last ? null : (
              <span
                aria-hidden
                className="absolute start-[7px] top-4 bottom-0 w-px bg-line"
              />
            )}
            <span
              aria-hidden
              className={cn(
                "mt-1 size-3.5 shrink-0 rounded-full border-2",
                reached || step.is_current
                  ? cn(
                      "border-transparent",
                      TONE_CLASSES[statusTone(step.status)],
                    )
                  : "border-line bg-surface",
                step.is_current && "ring-2 ring-brand/40",
              )}
            />
            <div className="flex flex-col">
              <span
                className={cn(
                  "font-medium",
                  !reached && !step.is_current && "text-ink-muted",
                )}
              >
                {step.label || statusLabel(step.status)}
              </span>
              <span className="text-xs text-ink-muted">
                {reached ? (
                  <bdi dir="ltr" className="tabular-nums">
                    {formatDateTime(step.reached_at as string)}
                  </bdi>
                ) : (
                  t.notReached
                )}
              </span>
              {step.cancel_reason ? (
                <span className="mt-1 text-sm text-danger">
                  {t.cancelReason}: {step.cancel_reason}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Who changed the status, when, and the note they left (`history`). */
export function OrderHistory({ order }: Props) {
  const t = m.orders.detail;
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {[...order.history].reverse().map((entry, index) => (
        <li
          key={index}
          className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0"
        >
          <span className="font-medium">
            {entry.from_status
              ? `${statusLabel(entry.from_status)} ← ${statusLabel(entry.to_status)}`
              : `${t.historyCreated}: ${statusLabel(entry.to_status)}`}
          </span>
          <span className="text-xs text-ink-muted">
            <bdi dir="ltr" className="tabular-nums">
              {formatDateTime(entry.created_at)}
            </bdi>
            {entry.changed_by_name
              ? ` · ${t.historyBy} ${entry.changed_by_name}`
              : ""}
          </span>
          {entry.note ? <span>{entry.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
