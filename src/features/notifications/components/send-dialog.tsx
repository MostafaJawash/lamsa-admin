import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LinkOut } from "@/features/banners";
import { m } from "@/messages";

import {
  BROADCAST_PHRASE,
  isBroadcast,
  isBroadcastConfirmed,
} from "../campaign";
import { useBroadcastCooldown } from "../cooldown";
import type { Audience } from "../list-filters";
import { PushPreview } from "./push-preview";

export type SendSummary = {
  audience: Audience;
  /** Who gets it: "جميع العملاء" or the customer's name. */
  audienceLabel: string;
  title: string;
  body: string;
  link: LinkOut;
  /** When: "فوراً" or the scheduled time, already formatted. */
  when: string;
  /** True for a campaign that is scheduled (changes the button wording only). */
  scheduled: boolean;
};

type Props = {
  /** What is about to be sent; null keeps the dialog closed. */
  summary: SendSummary | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * The gate in front of every send. It always shows the exact message and who gets it.
 * A broadcast (every customer, irreversible once pushed) additionally needs the admin to type
 * the confirmation phrase, and stays locked during the cooldown after the previous broadcast;
 * a message to one customer needs a plain confirmation.
 */
export function SendDialog({ summary, pending, onConfirm, onClose }: Props) {
  return (
    <Dialog open={summary !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {summary ? (
          <SendBody
            summary={summary}
            pending={pending}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SendBody({
  summary,
  pending,
  onConfirm,
  onClose,
}: {
  summary: SendSummary;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = m.notifications.send;
  const broadcast = isBroadcast(summary.audience);
  const [typed, setTyped] = useState("");
  const cooldown = useBroadcastCooldown();
  const locked = broadcast && cooldown.active;
  const armed =
    !pending && !locked && (!broadcast || isBroadcastConfirmed(typed));

  const confirmLabel = broadcast
    ? summary.scheduled
      ? t.confirmBroadcastScheduled
      : t.confirmBroadcast
    : summary.scheduled
      ? t.confirmUserScheduled
      : t.confirmUser;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (armed) onConfirm();
      }}
    >
      <DialogHeader>
        <DialogTitle>{broadcast ? t.broadcastTitle : t.userTitle}</DialogTitle>
        <DialogDescription>{t.previewHint}</DialogDescription>
      </DialogHeader>
      <PushPreview
        title={summary.title}
        body={summary.body}
        link={summary.link}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-muted">{t.to}</dt>
        <dd className="font-semibold">{summary.audienceLabel}</dd>
        <dt className="text-ink-muted">{t.when}</dt>
        <dd>{summary.when}</dd>
      </dl>
      {broadcast ? (
        <>
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm"
          >
            {t.broadcastWarning}
          </p>
          <FormField
            id="broadcast-confirm"
            label={`${t.typePrompt} ${BROADCAST_PHRASE}`}
          >
            <Input
              id="broadcast-confirm"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </FormField>
          {locked ? (
            <p role="status" className="text-sm text-warn">
              {m.notifications.compose.cooldown} {cooldown.seconds}{" "}
              {m.notifications.compose.seconds}
            </p>
          ) : null}
        </>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          {t.cancel}
        </Button>
        <Button
          type="submit"
          variant={broadcast ? "destructive" : "default"}
          disabled={!armed}
        >
          {pending ? t.sending : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
