import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import { orderKeys, useCancelOrder, useChangeStatus } from "../api";
import { cancelSchema, statusChangeSchema } from "../schema";
import { isPickupOrder, nextActions, type NextAction } from "../status";
import type { OrderDetail } from "../types";

type Props = { order: OrderDetail };

/**
 * The status buttons (exactly the steps the backend allows next, `allowed_next_statuses`)
 * and, clearly apart, the cancel action (only when `can_cancel`). Every action confirms first.
 */
export function OrderActions({ order }: Props) {
  const [step, setStep] = useState<NextAction | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const actions = nextActions(
    order.allowed_next_statuses,
    isPickupOrder(order),
  );
  const t = m.orders;

  if (actions.length === 0 && !order.can_cancel)
    return <p className="text-sm text-ink-muted">{t.detail.noActions}</p>;

  return (
    <div className="flex flex-col gap-4">
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.to} onClick={() => setStep(action)}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      {order.can_cancel ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Button
            variant="destructive"
            className="w-fit"
            onClick={() => setCancelling(true)}
          >
            {t.cancel.action}
          </Button>
        </div>
      ) : null}
      <StatusDialog order={order} step={step} onClose={() => setStep(null)} />
      <CancelDialog
        order={order}
        open={cancelling}
        onClose={() => setCancelling(false)}
      />
    </div>
  );
}

function StatusDialog({
  order,
  step,
  onClose,
}: {
  order: OrderDetail;
  step: NextAction | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={step !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {step ? (
          <StatusForm order={order} step={step} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatusForm({
  order,
  step,
  onClose,
}: {
  order: OrderDetail;
  step: NextAction;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const change = useChangeStatus(order.id);
  const client = useQueryClient();
  const t = m.orders.statusDialog;

  const submit = () => {
    const parsed = statusChangeSchema.safeParse({ note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    change.mutate(
      { to: step.to, note: parsed.data.note || undefined },
      {
        onSuccess: () => {
          toast.success(t.success);
          onClose();
        },
        onError: (failure) => {
          toast.error(errorMessage(failure));
          // The order may have moved under us: show the server's current state.
          void client.invalidateQueries({
            queryKey: orderKeys.detail(order.id),
          });
          onClose();
        },
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t.title}</DialogTitle>
        <DialogDescription>
          {t.description} <strong>{step.label}</strong>. {t.irreversible}
        </DialogDescription>
      </DialogHeader>
      <FormField id="status-note" label={t.note} error={error}>
        <Input
          id="status-note"
          maxLength={255}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </FormField>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={change.isPending}
        >
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={change.isPending}>
          {t.confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CancelDialog({
  order,
  open,
  onClose,
}: {
  order: OrderDetail;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {open ? <CancelForm order={order} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CancelForm({
  order,
  onClose,
}: {
  order: OrderDetail;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [keepStock, setKeepStock] = useState(false);
  const [error, setError] = useState<string>();
  const cancel = useCancelOrder(order.id);
  const client = useQueryClient();
  const t = m.orders.cancel;
  // The backend only accepts restore_stock=false for shipped orders (goods lost or not returned).
  const canKeepStock = order.status === "shipped";

  const submit = () => {
    const parsed = cancelSchema.safeParse({
      reason,
      restoreStock: !(canKeepStock && keepStock),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    cancel.mutate(
      { reason: parsed.data.reason, restoreStock: parsed.data.restoreStock },
      {
        onSuccess: () => {
          toast.success(t.success);
          onClose();
        },
        onError: (failure) => {
          toast.error(errorMessage(failure));
          void client.invalidateQueries({
            queryKey: orderKeys.detail(order.id),
          });
          onClose();
        },
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {t.title} #{order.id}
        </DialogTitle>
        <DialogDescription>
          {t.description}{" "}
          {canKeepStock && keepStock ? t.keepStockNote : t.stockRestored}
        </DialogDescription>
      </DialogHeader>
      <FormField id="cancel-reason" label={`${t.reason} *`} error={error}>
        <Textarea
          id="cancel-reason"
          rows={3}
          maxLength={255}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </FormField>
      {canKeepStock ? (
        <label className="flex items-center gap-2 text-sm max-md:min-h-11">
          <input
            type="checkbox"
            checked={keepStock}
            onChange={(event) => setKeepStock(event.target.checked)}
          />
          {t.keepStock}
        </label>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={cancel.isPending}
        >
          {t.back}
        </Button>
        <Button type="submit" variant="destructive" disabled={cancel.isPending}>
          {t.confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}
