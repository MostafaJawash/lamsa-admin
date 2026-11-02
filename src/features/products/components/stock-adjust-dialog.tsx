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
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import { useAdjustStock } from "../api";

export type StockTarget = {
  productId: number;
  variantId?: number;
  /** Product name, plus the variant label for a variant. */
  label: string;
  stock: number;
};

type Props = {
  target: StockTarget | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the new stock after a successful adjustment. */
  onAdjusted?: (stock: number) => void;
};

/** Quick stock correction through the dedicated `stock-adjust` endpoints (a delta, never an overwrite). */
export function StockAdjustDialog({ target, onOpenChange, onAdjusted }: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {target ? (
          <StockForm
            key={`${target.productId}-${target.variantId ?? 0}`}
            target={target}
            onClose={() => onOpenChange(false)}
            onAdjusted={onAdjusted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StockForm({
  target,
  onClose,
  onAdjusted,
}: {
  target: StockTarget;
  onClose: () => void;
  onAdjusted?: (stock: number) => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const adjust = useAdjustStock();
  const t = m.products.stockDialog;

  const submit = () => {
    const value = Number(delta.trim());
    if (!/^[+-]?\d+$/.test(delta.trim()) || value === 0) {
      setError(t.deltaInvalid);
      return;
    }
    setError(undefined);
    adjust.mutate(
      {
        productId: target.productId,
        variantId: target.variantId,
        delta: value,
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          toast.success(t.success);
          onAdjusted?.(result.stock);
          onClose();
        },
        onError: (failure) => setError(errorMessage(failure)),
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
          {target.label} — {t.current}: <bdi>{target.stock}</bdi>
        </DialogDescription>
      </DialogHeader>
      <FormField id="stock-delta" label={t.delta} error={error}>
        <Input
          id="stock-delta"
          dir="ltr"
          inputMode="numeric"
          value={delta}
          onChange={(event) => setDelta(event.target.value)}
          aria-invalid={error ? true : undefined}
          autoFocus
        />
      </FormField>
      <FormField id="stock-reason" label={t.reason}>
        <Input
          id="stock-reason"
          maxLength={255}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={adjust.isPending}>
          {t.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}
