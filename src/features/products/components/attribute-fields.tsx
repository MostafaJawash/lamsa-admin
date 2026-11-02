import { Controller, useFormContext } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CategoryAttribute } from "@/features/categories";
import { m } from "@/messages";

import type { ProductFormValues } from "../schema";

const NONE = "__none";

type Props = { definitions: readonly CategoryAttribute[] };

/** One input per attribute the category defines (text, number, select, multiselect, boolean, date). */
export function AttributeFields({ definitions }: Props) {
  const {
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  if (definitions.length === 0)
    return (
      <p className="text-sm text-ink-muted">{m.products.attributes.empty}</p>
    );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {definitions.map((def) => {
        const id = `attr-${def.key}`;
        const error = (
          errors.attributes as
            Record<string, { message?: string } | undefined> | undefined
        )?.[def.key]?.message;
        const label = `${def.label}${def.unit ? ` (${def.unit})` : ""}${def.is_required ? " *" : ""}`;
        return (
          <FormField key={def.key} id={id} label={label} error={error}>
            <Controller
              control={control}
              name={`attributes.${def.key}`}
              render={({ field }) => {
                const invalid = error ? true : undefined;
                switch (def.type) {
                  case "boolean":
                    return (
                      <Switch
                        id={id}
                        checked={field.value === true}
                        onCheckedChange={field.onChange}
                        aria-invalid={invalid}
                      />
                    );
                  case "select":
                    return (
                      <Select
                        value={
                          typeof field.value === "string" && field.value
                            ? field.value
                            : NONE
                        }
                        onValueChange={(value) =>
                          field.onChange(value === NONE ? "" : value)
                        }
                      >
                        <SelectTrigger
                          id={id}
                          aria-invalid={invalid}
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>
                            {m.products.form.fields.selectPlaceholder}
                          </SelectItem>
                          {(def.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  case "multiselect": {
                    const selected = Array.isArray(field.value)
                      ? (field.value as string[])
                      : [];
                    return (
                      <div
                        id={id}
                        className="flex flex-wrap gap-3"
                        role="group"
                      >
                        {(def.options ?? []).map((option) => (
                          <label
                            key={option}
                            className="flex items-center gap-1.5 text-sm max-md:min-h-11"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(option)}
                              onChange={(event) =>
                                field.onChange(
                                  event.target.checked
                                    ? [...selected, option]
                                    : selected.filter(
                                        (item) => item !== option,
                                      ),
                                )
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    );
                  }
                  case "date":
                    return (
                      <Input
                        id={id}
                        type="date"
                        dir="ltr"
                        value={
                          typeof field.value === "string" ? field.value : ""
                        }
                        onChange={field.onChange}
                        aria-invalid={invalid}
                      />
                    );
                  case "number":
                    return (
                      <Input
                        id={id}
                        dir="ltr"
                        inputMode="decimal"
                        value={
                          typeof field.value === "string" ? field.value : ""
                        }
                        onChange={field.onChange}
                        aria-invalid={invalid}
                      />
                    );
                  default:
                    return (
                      <Input
                        id={id}
                        value={
                          typeof field.value === "string" ? field.value : ""
                        }
                        onChange={field.onChange}
                        aria-invalid={invalid}
                      />
                    );
                }
              }}
            />
          </FormField>
        );
      })}
    </div>
  );
}
