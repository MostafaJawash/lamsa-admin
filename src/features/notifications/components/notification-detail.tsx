import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { LinkText } from "@/features/banners";
import { formatDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import {
  BroadcastCooldownError,
  useCancelNotification,
  useSendNotificationNow,
  type AdminNotification,
} from "../api";
import { audienceText, isBroadcast } from "../campaign";
import { EditNotificationDialog } from "./edit-dialog";
import { StatusBadge } from "./notifications-table";
import { PushPreview } from "./push-preview";
import { SendDialog, type SendSummary } from "./send-dialog";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** One campaign: what was sent, to whom, its status and delivery numbers, and (while scheduled) its actions. */
export function NotificationDetail({
  notification: n,
}: {
  notification: AdminNotification;
}) {
  const t = m.notifications.detail;
  const a = m.notifications.scheduledActions;
  const [editing, setEditing] = useState<AdminNotification | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [sending, setSending] = useState(false);
  const cancel = useCancelNotification(n.id);
  const sendNow = useSendNotificationNow(n);
  const submitting = useRef(false);
  const scheduled = n.status === "scheduled";
  const inFlight = n.status === "queued" || n.status === "sending";
  const link = { type: n.link.type, value: n.link.value };

  const summary: SendSummary | null = sending
    ? {
        audience: n.audience,
        audienceLabel: audienceText(n),
        title: n.title,
        body: n.body,
        link,
        when: m.notifications.send.whenNow,
        scheduled: false,
      }
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={n.status} />
        {n.deferred_by_quiet_hours ? (
          <span className="text-sm text-ink-muted">
            {m.notifications.deferred}
          </span>
        ) : null}
        {inFlight ? (
          <span className="text-sm text-ink-muted">{t.refreshing}</span>
        ) : null}
      </div>

      <PushPreview title={n.title} body={n.body} link={link} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <Row label={t.audience}>{audienceText(n)}</Row>
        <Row label={t.link}>
          <LinkText link={link} />
        </Row>
        <Row label={t.createdAt}>
          <span className="tabular-nums">{formatDateTime(n.created_at)}</span>
        </Row>
        {n.created_by_name ? (
          <Row label={t.createdBy}>{n.created_by_name}</Row>
        ) : null}
        {n.scheduled_at ? (
          <Row label={t.scheduledAt}>
            <span className="tabular-nums">
              {formatDateTime(n.scheduled_at)}
            </span>
          </Row>
        ) : null}
        {n.sent_at ? (
          <Row label={t.sentAt}>
            <span className="tabular-nums">{formatDateTime(n.sent_at)}</span>
          </Row>
        ) : null}
      </dl>

      {n.status === "sent" ? (
        <section className="flex flex-col gap-2 rounded-xl border border-line p-4">
          <h2 className="font-semibold">{t.stats}</h2>
          <dl
            data-testid="delivery-stats"
            className="grid grid-cols-3 gap-3 text-center"
          >
            {(
              [
                ["recipients", n.recipients_count],
                ["success", n.success_count],
                ["failure", n.failure_count],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <dt className="text-xs text-ink-muted">
                  {m.notifications.delivery[key]}
                </dt>
                <dd className="text-xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-ink-muted">{t.statsHint}</p>
        </section>
      ) : null}

      {scheduled ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(n)}>
            {a.edit}
          </Button>
          <Button variant="outline" onClick={() => setCancelling(true)}>
            {a.cancel}
          </Button>
          <Button
            variant={isBroadcast(n.audience) ? "destructive" : "default"}
            onClick={() => setSending(true)}
          >
            {a.sendNow}
          </Button>
        </div>
      ) : null}

      <EditNotificationDialog
        notification={editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={a.cancelTitle}
        description={`${n.title} — ${a.cancelDescription}`}
        confirmLabel={a.cancelConfirm}
        destructive
        pending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: () => {
              toast.success(a.cancelled);
              setCancelling(false);
            },
            onError: (error) => {
              toast.error(errorMessage(error));
              setCancelling(false);
            },
          })
        }
      />
      <SendDialog
        summary={summary}
        pending={sendNow.isPending}
        onClose={() => setSending(false)}
        onConfirm={() => {
          if (submitting.current) return; // a second click must not start a second send
          submitting.current = true;
          sendNow.mutate(undefined, {
            onSettled: () => {
              submitting.current = false;
            },
            onSuccess: () => {
              toast.success(a.sent);
              setSending(false);
            },
            onError: (error) => {
              if (error instanceof BroadcastCooldownError) return;
              toast.error(errorMessage(error));
              setSending(false);
            },
          });
        }}
      />
    </div>
  );
}
