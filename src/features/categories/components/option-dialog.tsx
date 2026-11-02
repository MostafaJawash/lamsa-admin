import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyFieldErrors } from "@/lib/form-errors";
import { m } from "@/messages";

import { useVariantOptionMutations, type CategoryVariantOption } from "../api";
import {
  VARIANT_OPTION_TYPES,
  cleanOptions,
  inUseDetails,
  type VariantOptionType,
} from "../definitions";
import { buildOptionSchema, type OptionFormValues } from "../schema";
import { OptionsListEditor } from "./options-list-editor";

type Props = {
  categoryId: number;
  option: CategoryVariantOption | null;
  open: boolean;
  onClose: () => void;
};

export function OptionDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {props.open ? <OptionForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = ["key", "label", "type", "options", "sort_order"];

/** A variant option: a color (free name + hex per product) or a select (optional preset list). */
function OptionForm({ categoryId, option, onClose }: Props) {
  const editing = option !== null;
  const t = m.categories.optionDialog;
  const a = m.categories.attributeDialog;
  const labels = m.categories.definitions.typeLabels;
  const mutations = useVariantOptionMutations(categoryId);
  const schema = useMemo(() => buildOptionSchema(editing), [editing]);
  const form = useForm<OptionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      key: option?.key ?? "",
      label: option?.label ?? "",
      type: option?.type ?? "color",
      options: option?.options ?? [],
      sort_order: String(option?.sort_order ?? 0),
    },
  });
  const { control, register, watch, handleSubmit, setError, formState } = form;
  const type = watch("type") as VariantOptionType;
  const pending = mutations.create.isPending || mutations.update.isPending;
  const err = (name: keyof OptionFormValues) =>
    (formState.errors[name] as { message?: string } | undefined)?.message;

  const onError = (error: unknown) => {
    const unmapped = applyFieldErrors(error, setError, {
      fields: FIELDS,
      codeFields: {
        ATTRIBUTE_KEY_TAKEN: "key",
        VARIANT_OPTION_IN_USE: "type",
        OPTION_IN_USE: "options",
      },
    });
    for (const message of unmapped) toast.error(message);
    const detail = inUseDetails(error);
    if (detail) toast.error(detail);
  };

  const submit = handleSubmit((values) => {
    const list = type === "select" ? cleanOptions(values.options) : [];
    const sort = Number(values.sort_order.trim());
    if (option) {
      mutations.update.mutate(
        {
          id: option.id,
          body: {
            label: values.label.trim(),
            type,
            options: list.length > 0 ? list : null,
            sort_order: sort,
          },
        },
        {
          onSuccess: () => {
            toast.success(t.updated);
            onClose();
          },
          onError,
        },
      );
      return;
    }
    mutations.create.mutate(
      {
        key: values.key.trim(),
        label: values.label.trim(),
        type,
        options: list.length > 0 ? list : undefined,
        sort_order: sort,
      },
      {
        onSuccess: () => {
          toast.success(t.created);
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? t.editTitle : t.addTitle}</DialogTitle>
      </DialogHeader>
      <FormField
        id="opt-key"
        label={`${t.key} *`}
        hint={t.keyHint}
        error={err("key")}
      >
        <Input
          id="opt-key"
          dir="ltr"
          maxLength={50}
          disabled={editing}
          aria-invalid={err("key") ? true : undefined}
          {...register("key")}
        />
      </FormField>
      <FormField id="opt-label" label={`${t.label} *`} error={err("label")}>
        <Input
          id="opt-label"
          maxLength={100}
          aria-invalid={err("label") ? true : undefined}
          {...register("label")}
        />
      </FormField>
      <FormField id="opt-type" label={t.type} error={err("type")}>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="opt-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIANT_OPTION_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {labels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      {type === "color" ? (
        <p className="text-sm text-ink-muted">{t.colorNote}</p>
      ) : (
        <FormField
          id="opt-options"
          label={t.options}
          hint={t.selectNote}
          error={err("options")}
        >
          <Controller
            control={control}
            name="options"
            render={({ field }) => (
              <OptionsListEditor
                id="opt-options"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(err("options"))}
              />
            )}
          />
        </FormField>
      )}
      <FormField id="opt-sort" label={a.sortOrder} error={err("sort_order")}>
        <Input
          id="opt-sort"
          dir="ltr"
          inputMode="numeric"
          aria-invalid={err("sort_order") ? true : undefined}
          {...register("sort_order")}
        />
      </FormField>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {a.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
