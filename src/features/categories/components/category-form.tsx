import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useBlocker, useNavigate } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/lib/form-errors";
import { m } from "@/messages";

import {
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  type CategoryDetail,
} from "../api";
import { hasNonLatinLetters, suggestSlug } from "@/lib/slug";
import {
  EMPTY_CATEGORY,
  categorySchema,
  type CategoryFormValues,
} from "../schema";
import { canHaveParent, findNode, parentOptions } from "../tree";

const NO_PARENT = "__none";
const FIELDS = [
  "name",
  "slug",
  "parent_id",
  "description",
  "sort_order",
  "is_active",
];

type Props = { category?: CategoryDetail };

function toValues(category: CategoryDetail): CategoryFormValues {
  return {
    name: category.name,
    slug: category.slug,
    parent_id: category.parent_id === null ? "" : String(category.parent_id),
    description: category.description ?? "",
    sort_order: String(category.sort_order),
    is_active: category.is_active,
  };
}

/**
 * The category's own fields. On create, saving opens the edit page (the image, attributes and
 * variant options are sub-resources that need the new id). On edit, saving returns to the list.
 */
export function CategoryForm({ category }: Props) {
  const editing = category !== undefined;
  const t = m.categories.form;
  const navigate = useNavigate();
  const tree = useCategoryTree();
  const create = useCreateCategory();
  const update = useUpdateCategory(category?.id ?? 0);
  const allowLeave = useRef(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category ? toValues(category) : EMPTY_CATEGORY,
  });
  const {
    control,
    register,
    watch,
    setValue,
    handleSubmit,
    setError,
    formState,
  } = form;
  const name = watch("name");
  const slug = watch("slug");
  const saving = create.isPending || update.isPending;

  const blocker = useBlocker(
    () => formState.isDirty && !allowLeave.current && !saving,
  );

  const nodes = tree.data ?? [];
  const parents = parentOptions(nodes, category?.id ?? null);
  const current = category ? findNode(nodes, category.id) : undefined;
  const parentLocked = editing && !canHaveParent(current ?? category);

  const err = (field: keyof CategoryFormValues) =>
    (formState.errors[field] as { message?: string } | undefined)?.message;

  const nameField = register("name");

  const onError = (error: unknown) => {
    const unmapped = applyFieldErrors(error, setError, {
      fields: FIELDS,
      codeFields: {
        SLUG_TAKEN: "slug",
        CATEGORY_DEPTH_EXCEEDED: "parent_id",
        CATEGORY_NOT_FOUND: "parent_id",
      },
    });
    for (const message of unmapped) toast.error(message);
  };

  const leave = (path: string) => {
    allowLeave.current = true;
    navigate(path);
  };

  const submit = handleSubmit((values) => {
    const slugText = values.slug.trim();
    const description = values.description.trim();
    const common = {
      name: values.name.trim(),
      parent_id: values.parent_id ? Number(values.parent_id) : null,
      sort_order: Number(values.sort_order.trim()),
      is_active: values.is_active,
    };
    if (category) {
      update.mutate(
        {
          ...common,
          slug: slugText || undefined,
          description: description || null,
        },
        {
          onSuccess: () => {
            toast.success(t.updated);
            leave("/categories");
          },
          onError,
        },
      );
      return;
    }
    create.mutate(
      {
        ...common,
        slug: slugText || undefined,
        description: description || undefined,
      },
      {
        onSuccess: (created) => {
          toast.success(t.created);
          leave(`/categories/${created.id}/edit`);
        },
        onError,
      },
    );
  });

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label={`${t.fields.name} *`} error={err("name")}>
            <Input
              id="name"
              maxLength={100}
              aria-invalid={err("name") ? true : undefined}
              {...nameField}
              onChange={(event) => {
                void nameField.onChange(event);
                // Suggest a slug from a latin name until the admin edits the slug themselves.
                if (!editing && !formState.dirtyFields.slug)
                  setValue("slug", suggestSlug(event.target.value));
              }}
            />
          </FormField>
          <FormField
            id="slug"
            label={t.fields.slug}
            hint={
              !slug && hasNonLatinLetters(name)
                ? t.fields.slugArabicHint
                : t.fields.slugHint
            }
            error={err("slug")}
          >
            <Input
              id="slug"
              dir="ltr"
              maxLength={120}
              aria-invalid={err("slug") ? true : undefined}
              {...register("slug")}
            />
          </FormField>
          <FormField
            id="parent_id"
            label={t.fields.parent}
            hint={parentLocked ? t.fields.parentDisabled : t.fields.parentHint}
            error={err("parent_id")}
          >
            <Controller
              control={control}
              name="parent_id"
              render={({ field }) => (
                <Select
                  value={field.value || NO_PARENT}
                  disabled={parentLocked}
                  onValueChange={(value) =>
                    field.onChange(value === NO_PARENT ? "" : value)
                  }
                >
                  <SelectTrigger id="parent_id" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>
                      {t.fields.noParent}
                    </SelectItem>
                    {parents.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                        {option.inactive
                          ? ` (${m.categories.inactiveSuffix})`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField
            id="sort_order"
            label={t.fields.sortOrder}
            error={err("sort_order")}
          >
            <Input
              id="sort_order"
              dir="ltr"
              inputMode="numeric"
              aria-invalid={err("sort_order") ? true : undefined}
              {...register("sort_order")}
            />
          </FormField>
        </div>
        <FormField
          id="description"
          label={t.fields.description}
          error={err("description")}
        >
          <Textarea id="description" rows={3} {...register("description")} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Switch
                id="is_active"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          {t.fields.isActive}
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => navigate("/categories")}
          >
            {t.back}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) =>
          !open && blocker.state === "blocked" && blocker.reset()
        }
        title={t.unsaved.title}
        description={t.unsaved.description}
        confirmLabel={t.unsaved.leave}
        destructive
        onConfirm={() => blocker.state === "blocked" && blocker.proceed()}
      />
    </>
  );
}
