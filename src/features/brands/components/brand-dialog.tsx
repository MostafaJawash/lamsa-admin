import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import { ImageField } from "@/components/shared/image-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { applyFieldErrors } from "@/lib/form-errors";
import { hasNonLatinLetters, suggestSlug } from "@/lib/slug";
import { m } from "@/messages";

import {
  useBrandLogo,
  useCreateBrand,
  useUpdateBrand,
  type Brand,
} from "../api";
import { EMPTY_BRAND, brandSchema, type BrandFormValues } from "../schema";

type Props = {
  /** The brand to edit, "new" to create one, null when closed. */
  brand: Brand | "new" | null;
  onClose: () => void;
};

/** Create/edit a brand. Brands are small, so a dialog is enough (categories get a page). */
export function BrandDialog({ brand, onClose }: Props) {
  return (
    <Dialog open={brand !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {brand !== null ? (
          <BrandForm
            key={brand === "new" ? "new" : brand.id}
            brand={brand === "new" ? null : brand}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = [
  "name",
  "slug",
  "description",
  "sort_order",
  "is_own_brand",
  "is_active",
];

function toValues(brand: Brand): BrandFormValues {
  return {
    name: brand.name,
    slug: brand.slug,
    description: brand.description ?? "",
    sort_order: String(brand.sort_order),
    is_own_brand: brand.is_own_brand,
    is_active: brand.is_active,
  };
}

function BrandForm({
  brand,
  onClose,
}: {
  brand: Brand | null;
  onClose: () => void;
}) {
  const editing = brand !== null;
  const t = m.brands.form;
  const create = useCreateBrand();
  const update = useUpdateBrand(brand?.id ?? 0);
  const logo = useBrandLogo();
  const schema = useMemo(() => brandSchema, []);
  const form = useForm<BrandFormValues>({
    resolver: zodResolver(schema),
    defaultValues: brand ? toValues(brand) : EMPTY_BRAND,
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
  // A logo chosen while creating (the brand has no id yet); uploaded right after it is saved.
  const [staged, setStaged] = useState<File | null>(null);
  const [stagedUrl, setStagedUrl] = useState<string | null>(null);
  // The logo as it stands on the backend while editing (changes apply immediately).
  const [currentLogo, setCurrentLogo] = useState(brand?.logo ?? null);
  useEffect(() => {
    if (!staged) return setStagedUrl(null);
    const url = URL.createObjectURL(staged);
    setStagedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [staged]);
  const saving = create.isPending || update.isPending || logo.set.isPending;
  const err = (field: keyof BrandFormValues) =>
    (formState.errors[field] as { message?: string } | undefined)?.message;
  const nameField = register("name");

  const onError = (error: unknown) => {
    const unmapped = applyFieldErrors(error, setError, {
      fields: FIELDS,
      codeFields: { SLUG_TAKEN: "slug" },
    });
    for (const message of unmapped) toast.error(message);
  };

  const submit = handleSubmit((values) => {
    const slugText = values.slug.trim();
    const description = values.description.trim();
    const common = {
      name: values.name.trim(),
      sort_order: Number(values.sort_order.trim()),
      is_own_brand: values.is_own_brand,
      is_active: values.is_active,
    };
    if (brand) {
      update.mutate(
        {
          ...common,
          slug: slugText || undefined,
          description: description || null,
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
    create.mutate(
      {
        ...common,
        slug: slugText || undefined,
        description: description || undefined,
      },
      {
        onSuccess: async (created) => {
          if (staged) {
            try {
              await logo.set.mutateAsync({ id: created.id, file: staged });
            } catch {
              toast.error(t.logoFailed);
              onClose();
              return;
            }
          }
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
        <DialogTitle>
          {editing ? m.brands.editTitle : m.brands.addTitle}
        </DialogTitle>
      </DialogHeader>
      <FormField
        id="brand-name"
        label={`${t.fields.name} *`}
        error={err("name")}
      >
        <Input
          id="brand-name"
          maxLength={100}
          aria-invalid={err("name") ? true : undefined}
          {...nameField}
          onChange={(event) => {
            void nameField.onChange(event);
            if (!editing && !formState.dirtyFields.slug)
              setValue("slug", suggestSlug(event.target.value));
          }}
        />
      </FormField>
      <FormField
        id="brand-slug"
        label={t.fields.slug}
        hint={
          !slug && hasNonLatinLetters(name)
            ? m.categories.form.fields.slugArabicHint
            : t.fields.slugHint
        }
        error={err("slug")}
      >
        <Input
          id="brand-slug"
          dir="ltr"
          maxLength={120}
          aria-invalid={err("slug") ? true : undefined}
          {...register("slug")}
        />
      </FormField>
      <FormField
        id="brand-description"
        label={t.fields.description}
        error={err("description")}
      >
        <Textarea
          id="brand-description"
          rows={3}
          {...register("description")}
        />
      </FormField>
      <FormField
        id="brand-sort"
        label={t.fields.sortOrder}
        error={err("sort_order")}
      >
        <Input
          id="brand-sort"
          dir="ltr"
          inputMode="numeric"
          aria-invalid={err("sort_order") ? true : undefined}
          {...register("sort_order")}
        />
      </FormField>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t.fields.logo}</span>
        <ImageField
          image={currentLogo}
          stagedUrl={stagedUrl}
          labels={m.categories.image}
          pending={logo.set.isPending || logo.remove.isPending}
          onPick={(file) => {
            if (!brand) return setStaged(file);
            logo.set.mutate(
              { id: brand.id, file },
              {
                onSuccess: (updated) => {
                  setCurrentLogo(updated.logo);
                  toast.success(m.categories.image.updated);
                },
                onError: (error) => toast.error(errorMessage(error)),
              },
            );
          }}
          onRemove={() => {
            if (!brand) return setStaged(null);
            logo.remove.mutate(brand.id, {
              onSuccess: () => {
                setCurrentLogo(null);
                toast.success(m.categories.image.removed);
              },
              onError: (error) => toast.error(errorMessage(error)),
            });
          }}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Controller
          control={control}
          name="is_own_brand"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        {t.fields.isOwnBrand}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              id="brand-active"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        {t.fields.isActive}
      </label>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
        >
          {t.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
