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
import { fromStoreInput, toStoreInput } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { applyFieldErrors } from "@/lib/form-errors";
import { m } from "@/messages";

import {
  useCreateBanner,
  useReplaceBannerImage,
  useUpdateBanner,
  type Banner,
} from "../api";
import { fromBackendLink, toBackendLink } from "../link";
import { EMPTY_BANNER, bannerSchema, type BannerFormValues } from "../schema";
import { LinkTargetField } from "./link-target-field";

type Props = {
  /** The banner to edit, "new" to create one, null when closed. */
  banner: Banner | "new" | null;
  onClose: () => void;
};

/**
 * Create/edit a banner. The field set is small (image, title, subtitle, link, active, dates),
 * so a dialog is enough; the link target picker is the only non-trivial part.
 */
export function BannerDialog({ banner, onClose }: Props) {
  return (
    <Dialog open={banner !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {banner !== null ? (
          <BannerForm
            key={banner === "new" ? "new" : banner.id}
            banner={banner === "new" ? null : banner}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = [
  "title",
  "subtitle",
  "link",
  "is_active",
  "starts_at",
  "ends_at",
];

function toValues(banner: Banner): BannerFormValues {
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? "",
    link: fromBackendLink(banner.link),
    is_active: banner.is_active,
    starts_at: banner.starts_at ? toStoreInput(banner.starts_at) : "",
    ends_at: banner.ends_at ? toStoreInput(banner.ends_at) : "",
  };
}

function BannerForm({
  banner,
  onClose,
}: {
  banner: Banner | null;
  onClose: () => void;
}) {
  const editing = banner !== null;
  const t = m.banners.form;
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const replaceImage = useReplaceBannerImage();
  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema) as never,
    defaultValues: banner ? toValues(banner) : EMPTY_BANNER,
  });
  const { control, register, handleSubmit, setError, formState } = form;
  // An image chosen while creating (the banner has no id yet); sent with the form.
  const [staged, setStaged] = useState<File | null>(null);
  const stagedUrl = useMemo(
    () => (staged ? URL.createObjectURL(staged) : null),
    [staged],
  );
  const [imageError, setImageError] = useState<string | null>(null);
  // The image as it stands on the backend while editing (a replacement applies immediately).
  const [currentImage, setCurrentImage] = useState(banner?.image ?? null);
  useEffect(
    () => () => {
      if (stagedUrl) URL.revokeObjectURL(stagedUrl);
    },
    [stagedUrl],
  );
  const saving = create.isPending || update.isPending || replaceImage.isPending;
  const err = (field: keyof BannerFormValues) =>
    (formState.errors[field] as { message?: string } | undefined)?.message;

  const onError = (error: unknown) => {
    const unmapped = applyFieldErrors(error, setError, {
      fields: FIELDS,
      codeFields: { INVALID_LINK: "link" },
    });
    for (const message of unmapped) toast.error(message);
  };

  const submit = handleSubmit((values) => {
    const title = values.title.trim();
    const subtitle = values.subtitle.trim();
    const link = toBackendLink(values.link);
    const starts = values.starts_at ? fromStoreInput(values.starts_at) : null;
    const ends = values.ends_at ? fromStoreInput(values.ends_at) : null;
    if (banner) {
      update.mutate(
        {
          id: banner.id,
          body: {
            title,
            subtitle: subtitle || null,
            link,
            is_active: values.is_active,
            starts_at: starts,
            ends_at: ends,
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
    if (!staged) return setImageError(t.validation.imageRequired);
    create.mutate(
      {
        image: staged,
        title,
        subtitle: subtitle || null,
        link,
        is_active: values.is_active,
        starts_at: starts,
        ends_at: ends,
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
        <DialogTitle>
          {editing ? m.banners.editTitle : m.banners.addTitle}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{`${t.fields.image} *`}</span>
        <ImageField
          image={currentImage}
          stagedUrl={stagedUrl}
          labels={m.banners.image}
          pending={replaceImage.isPending}
          onPick={(file) => {
            setImageError(null);
            if (!banner) return setStaged(file);
            replaceImage.mutate(
              { id: banner.id, file },
              {
                onSuccess: (updated) => {
                  setCurrentImage(updated.image);
                  toast.success(m.banners.image.updated);
                },
                onError: (error) => toast.error(errorMessage(error)),
              },
            );
          }}
        />
        {imageError ? (
          <p role="alert" className="text-xs text-danger">
            {imageError}
          </p>
        ) : null}
      </div>
      <FormField
        id="banner-title"
        label={`${t.fields.title} *`}
        error={err("title")}
      >
        <Input
          id="banner-title"
          maxLength={150}
          aria-invalid={err("title") ? true : undefined}
          {...register("title")}
        />
      </FormField>
      <FormField
        id="banner-subtitle"
        label={t.fields.subtitle}
        error={err("subtitle")}
      >
        <Input
          id="banner-subtitle"
          maxLength={255}
          aria-invalid={err("subtitle") ? true : undefined}
          {...register("subtitle")}
        />
      </FormField>
      <Controller
        control={control}
        name="link"
        render={({ field }) => (
          <LinkTargetField
            id="banner-link"
            value={field.value}
            onChange={field.onChange}
            error={err("link")}
          />
        )}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id="banner-starts"
          label={t.fields.startsAt}
          error={err("starts_at")}
        >
          <Input
            id="banner-starts"
            type="datetime-local"
            dir="ltr"
            {...register("starts_at")}
          />
        </FormField>
        <FormField
          id="banner-ends"
          label={t.fields.endsAt}
          error={err("ends_at")}
        >
          <Input
            id="banner-ends"
            type="datetime-local"
            dir="ltr"
            {...register("ends_at")}
          />
        </FormField>
      </div>
      <p className="-mt-2 text-xs text-ink-muted">{t.datesHint}</p>
      <label className="flex items-center gap-2 text-sm max-md:min-h-11">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              id="banner-active"
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
