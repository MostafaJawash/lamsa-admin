import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  Controller,
  get,
  useFieldArray,
  useFormContext,
} from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CategoryVariantOption } from "@/features/categories";
import { m } from "@/messages";

import { emptyVariant } from "../payload";
import type { ProductFormValues } from "../schema";
import type { StockTarget } from "./stock-adjust-dialog";

type Props = {
  definitions: readonly CategoryVariantOption[];
  /** Edit mode: existing variants show their stock read-only with an adjust button. */
  editing: boolean;
  productId?: number;
  productName?: string;
  /** Live stock of existing variants (changes through the stock dialog). */
  stockById: Readonly<Record<number, number>>;
  onAdjustStock: (target: StockTarget) => void;
};

/** The "خيارات المنتج" section: one row per variant, with the category's option fields. */
export function VariantsEditor({
  definitions,
  editing,
  productId,
  productName,
  stockById,
  onAdjustStock,
}: Props) {
  const t = m.products.variants;
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });
  const rootError = (errors.variants as { message?: string } | undefined)
    ?.message;

  if (definitions.length === 0)
    return <p className="text-sm text-ink-muted">{t.noOptions}</p>;

  return (
    <div className="flex flex-col gap-4">
      {fields.map((row, index) => {
        const base = `variants.${index}` as const;
        const err = (path: string): string | undefined =>
          get(errors, `${base}.${path}`)?.message;
        const variantId = watch(`${base}.id`);
        const isExisting = editing && variantId !== undefined;
        const label = definitions
          .map((def) => watch(`${base}.options.${def.key}`))
          .filter(Boolean)
          .join("، ");
        return (
          <fieldset
            key={row.id}
            className="flex flex-col gap-3 rounded-lg border border-line p-3"
          >
            <legend className="px-1 text-sm font-medium">
              {t.row} {index + 1}
              {label ? ` — ${label}` : ""}
            </legend>
            {err("options") ? (
              <p role="alert" className="text-xs text-danger">
                {err("options")}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {definitions.map((def) => {
                const id = `${base}-opt-${def.key}`;
                const optionError = err(`options.${def.key}`);
                return (
                  <FormField
                    key={def.key}
                    id={id}
                    label={def.label}
                    error={optionError ?? err(`options.${def.key}_hex`)}
                  >
                    <div className="flex items-center gap-2">
                      {def.type === "select" &&
                      (def.options?.length ?? 0) > 0 ? (
                        <Controller
                          control={control}
                          name={`${base}.options.${def.key}`}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                id={id}
                                aria-invalid={optionError ? true : undefined}
                                className="w-full"
                              >
                                <SelectValue
                                  placeholder={
                                    m.products.form.fields.selectPlaceholder
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {(def.options ?? []).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      ) : (
                        <Input
                          id={id}
                          maxLength={50}
                          aria-invalid={optionError ? true : undefined}
                          {...register(`${base}.options.${def.key}`)}
                        />
                      )}
                      {def.type === "color" ? (
                        <input
                          type="color"
                          aria-label={`${def.label}: ${t.colorHex}`}
                          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-line bg-transparent"
                          {...register(`${base}.options.${def.key}_hex`)}
                        />
                      ) : null}
                    </div>
                  </FormField>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                id={`${base}-price`}
                label={t.price}
                error={err("price")}
              >
                <Input
                  id={`${base}-price`}
                  dir="ltr"
                  inputMode="decimal"
                  aria-invalid={err("price") ? true : undefined}
                  {...register(`${base}.price`)}
                />
              </FormField>
              <FormField
                id={`${base}-sale`}
                label={t.salePrice}
                error={err("sale_price")}
              >
                <Input
                  id={`${base}-sale`}
                  dir="ltr"
                  inputMode="decimal"
                  aria-invalid={err("sale_price") ? true : undefined}
                  {...register(`${base}.sale_price`)}
                />
              </FormField>
              {isExisting ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t.stock}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {stockById[variantId as number] ?? watch(`${base}.stock`)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onAdjustStock({
                          productId: productId as number,
                          variantId: variantId as number,
                          label: `${productName ?? ""} — ${label}`,
                          stock: Number(
                            stockById[variantId as number] ??
                              watch(`${base}.stock`),
                          ),
                        })
                      }
                    >
                      {t.stockAdjust}
                    </Button>
                  </div>
                </div>
              ) : (
                <FormField
                  id={`${base}-stock`}
                  label={t.stock}
                  error={err("stock")}
                >
                  <Input
                    id={`${base}-stock`}
                    dir="ltr"
                    inputMode="numeric"
                    aria-invalid={err("stock") ? true : undefined}
                    {...register(`${base}.stock`)}
                  />
                </FormField>
              )}
              <FormField id={`${base}-sku`} label={t.sku} error={err("sku")}>
                <Input
                  id={`${base}-sku`}
                  dir="ltr"
                  maxLength={64}
                  aria-invalid={err("sku") ? true : undefined}
                  {...register(`${base}.sku`)}
                />
              </FormField>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Controller
                  control={control}
                  name={`${base}.is_active`}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                {t.active}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
              >
                <Trash2Icon data-icon="inline-start" className="text-danger" />
                {t.remove}
              </Button>
            </div>
          </fieldset>
        );
      })}
      {rootError ? (
        <p role="alert" className="text-xs text-danger">
          {rootError}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => append(emptyVariant(definitions))}
        >
          <PlusIcon data-icon="inline-start" />
          {t.add}
        </Button>
      </div>
    </div>
  );
}
