import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import { useResetPassword, useSetCustomerActive } from "../api";
import { canResetPassword, isCustomerAccount } from "../labels";
import type { Customer } from "../types";

/**
 * What the backend lets an admin do to a customer account: activate/deactivate and reset a
 * phone account's password. Nothing else (no editing, no role changes) is offered.
 */
export function CustomerActions({ customer }: { customer: Customer }) {
  const t = m.customers.actions;
  const [toggling, setToggling] = useState(false);
  const [resetting, setResetting] = useState(false);
  const setActive = useSetCustomerActive(customer.id);
  const d = m.customers.toggleDialog;

  if (!isCustomerAccount(customer)) return null;

  const confirmToggle = () =>
    setActive.mutate(!customer.is_active, {
      onSuccess: () => {
        toast.success(customer.is_active ? d.deactivated : d.activated);
        setToggling(false);
      },
      onError: (error) => {
        toast.error(errorMessage(error));
        setToggling(false);
      },
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={customer.is_active ? "destructive" : "default"}
          onClick={() => setToggling(true)}
        >
          {customer.is_active ? t.deactivate : t.activate}
        </Button>
        {canResetPassword(customer) ? (
          <Button variant="outline" onClick={() => setResetting(true)}>
            {t.resetPassword}
          </Button>
        ) : null}
      </div>
      {!canResetPassword(customer) ? (
        <p className="text-xs text-ink-muted">{t.noPasswordAccount}</p>
      ) : null}

      <ConfirmDialog
        open={toggling}
        onOpenChange={setToggling}
        title={customer.is_active ? d.deactivateTitle : d.activateTitle}
        description={`${customer.name} — ${customer.is_active ? d.deactivateDescription : d.activateDescription}`}
        confirmLabel={
          customer.is_active ? d.confirmDeactivate : d.confirmActivate
        }
        destructive={customer.is_active}
        pending={setActive.isPending}
        onConfirm={confirmToggle}
      />
      <ResetPasswordDialog
        customer={customer}
        open={resetting}
        onClose={() => setResetting(false)}
      />
    </div>
  );
}

/**
 * Resetting hands over a live credential and cannot be undone, so the button only activates
 * after the admin types the confirmation word. The password then shows once, in memory only.
 */
function ResetPasswordDialog({
  customer,
  open,
  onClose,
}: {
  customer: Customer;
  open: boolean;
  onClose: () => void;
}) {
  const reset = useResetPassword(customer.id);
  const [typed, setTyped] = useState("");
  const t = m.customers.reset;

  const close = () => {
    reset.reset(); // forget the temporary password
    setTyped("");
    onClose();
  };

  const password = reset.data?.temporary_password;
  const armed = typed.trim() === t.typeWord;

  const submit = () =>
    reset.mutate(undefined, {
      onError: (error) => {
        toast.error(errorMessage(error));
        close();
      },
    });

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success(t.copied);
    } catch {
      // clipboard unavailable: the password is on screen to read out
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        {password ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t.resultTitle}</DialogTitle>
              <DialogDescription>{t.resultHint}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                data-testid="temporary-password"
                className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-center text-lg font-semibold tracking-wider select-all"
              >
                {password}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copy()}
              >
                <CopyIcon data-icon="inline-start" />
                {t.copy}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={close}>
                {t.close}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (armed) submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>
                {customer.name} — {t.description}
              </DialogDescription>
            </DialogHeader>
            <FormField id="reset-confirm" label={t.typePrompt}>
              <Input
                id="reset-confirm"
                autoComplete="off"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </FormField>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={reset.isPending}
              >
                {m.common.cancel}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!armed || reset.isPending}
              >
                {t.confirm}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
