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
import { Switch } from "@/components/ui/switch";
import { applyFieldErrors } from "@/lib/form-errors";
import { m } from "@/messages";

import { useAttributeMutations, type CategoryAttribute } from "../api";
import {
  ATTRIBUTE_TYPES,
  attributeNeedsOptions,
  cleanOptions,
  controlFor,
  inUseDetails,
  type AttributeType,
} from "../definitions";
import { buildAttributeSchema, type AttributeFormValues } from "../schema";
import { OptionsListEditor } from "./options-list-editor";

type Props = {
  categoryId: number;
  /** The attribute being edited; null opens the dialog in create mode. */
  attribute: CategoryAttribute | null;
  open: boolean;
  onClose: () => void;
};

export function AttributeDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {props.open ? <AttributeForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = ["key", "label", "type", "options", "unit", "sort_order"];

function AttributeForm({ categoryId, attribute, onClose }: Props) {
  const editing = attribute !== null;
  const t = m.categories.attributeDialog;
  const labels = m.categories.definitions.typeLabels;
  const mutations = useAttributeMutations(categoryId);
  const schema = useMemo(() => buildAttributeSchema(editing), [editing]);
  const form = useForm<AttributeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      key: attribute?.key ?? "",
      label: attribute?.label ?? "",
      type: attribute?.type ?? "text",
      options: attribute?.options ?? [],
      unit: attribute?.unit ?? "",
      is_required: attribute?.is_required ?? false,
      is_filterable: attribute?.is_filterable ?? false,
      sort_order: String(attribute?.sort_order ?? 0),
    },
  });
  const { control, register, watch, handleSubmit, setError, formState } = form;
  const type = watch("type") as AttributeType;
  const needsOptions = attributeNeedsOptions(type);
  const pending = mutations.create.isPending || mutations.update.isPending;
  const err = (name: keyof AttributeFormValues) =>
    (formState.errors[name] as { message?: string } | undefined)?.message;

  const onError = (error: unknown) => {
    const unmapped = applyFieldErrors(error, setError, {
      fields: FIELDS,
      codeFields: {
        ATTRIBUTE_KEY_TAKEN: "key",
        ATTRIBUTE_IN_USE: "type",
        OPTION_IN_USE: "options",
      },
    });
    for (const message of unmapped) toast.error(message);
    const detail = inUseDetails(error);
    if (detail) toast.error(detail);
  };

  const submit = handleSubmit((values) => {
    const options = needsOptions ? cleanOptions(values.options) : null;
    const unit = values.unit.trim();
    const sort = Number(values.sort_order.trim());
    if (attribute) {
      mutations.update.mutate(
        {
          id: attribute.id,
          body: {
            label: values.label.trim(),
            type: values.type as AttributeType,
            options,
            unit: unit || null,
            is_required: values.is_required,
            is_filterable: values.is_filterable,
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
        type: values.type as AttributeType,
        options: options ?? undefined,
        unit: unit || undefined,
        is_required: values.is_required,
        is_filterable: values.is_filterable,
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
        id="attr-key"
        label={`${t.key} *`}
        hint={t.keyHint}
        error={err("key")}
      >
        <Input
          id="attr-key"
          dir="ltr"
          maxLength={50}
          disabled={editing}
          aria-invalid={err("key") ? true : undefined}
          {...register("key")}
        />
      </FormField>
      <FormField id="attr-label" label={`${t.label} *`} error={err("label")}>
        <Input
          id="attr-label"
          maxLength={100}
          aria-invalid={err("label") ? true : undefined}
          {...register("label")}
        />
      </FormField>
      <FormField id="attr-type" label={t.type} error={err("type")}>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="attr-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTRIBUTE_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {labels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      {needsOptions ? (
        <FormField
          id="attr-options"
          label={`${t.options} *`}
          error={err("options")}
        >
          <Controller
            control={control}
            name="options"
            render={({ field }) => (
              <OptionsListEditor
                id="attr-options"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(err("options"))}
              />
            )}
          />
        </FormField>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="attr-unit" label={t.unit} error={err("unit")}>
          <Input
            id="attr-unit"
            maxLength={20}
            aria-invalid={err("unit") ? true : undefined}
            {...register("unit")}
          />
        </FormField>
        <FormField id="attr-sort" label={t.sortOrder} error={err("sort_order")}>
          <Input
            id="attr-sort"
            dir="ltr"
            inputMode="numeric"
            aria-invalid={err("sort_order") ? true : undefined}
            {...register("sort_order")}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm max-md:min-h-11">
        <Controller
          control={control}
          name="is_required"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        {t.required}
      </label>
      <label className="flex items-center gap-2 text-sm max-md:min-h-11">
        <Controller
          control={control}
          name="is_filterable"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        {t.filterable}
      </label>
      <p className="text-xs text-ink-muted" data-control={controlFor(type)}>
        {t.preview}: <strong>{controlLabel(controlFor(type))}</strong>
      </p>
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
          {t.save}
        </Button>
      </DialogFooter>
    </form>
  );
}

function controlLabel(kind: ReturnType<typeof controlFor>): string {
  const labels = m.categories.definitions.typeLabels;
  return kind === "checkbox" ? labels.boolean! : (labels[kind] ?? kind);
}
