import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  LinkTargetField,
  fromBackendLink,
  toBackendLink,
} from "@/features/banners";
import { fromStoreInput, toStoreInput } from "@/lib/dates";
import { applyFieldErrors } from "@/lib/form-errors";
import { m } from "@/messages";

import { useUpdateNotification, type AdminNotification } from "../api";
import { editSchema, type EditValues } from "../schema";

type Props = {
  notification: AdminNotification | null;
  onClose: () => void;
};

/** Editing is only possible while a campaign is still scheduled (otherwise 409). */
export function EditNotificationDialog({ notification, onClose }: Props) {
  return (
    <Dialog
      open={notification !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {notification ? (
          <EditForm
            key={notification.id}
            notification={notification}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = ["title", "body", "link", "scheduled_at"];

function EditForm({
  notification,
  onClose,
}: {
  notification: AdminNotification;
  onClose: () => void;
}) {
  const t = m.notifications.scheduledActions;
  const c = m.notifications.compose;
  const update = useUpdateNotification(notification.id);
  const initialWhen = notification.scheduled_at
    ? toStoreInput(notification.scheduled_at)
    : "";
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema) as never,
    defaultValues: {
      title: notification.title,
      body: notification.body,
      link: fromBackendLink(notification.link),
      scheduled_at: initialWhen,
    },
  });
  const { control, register, handleSubmit, setError, formState } = form;
  const err = (field: keyof EditValues) =>
    (formState.errors[field] as { message?: string } | undefined)?.message;

  const submit = handleSubmit((values) => {
    update.mutate(
      {
        title: values.title.trim(),
        body: values.body.trim(),
        link: toBackendLink(values.link),
        // Only a changed time is sent: the unchanged one may by now be less than a minute away.
        ...(values.scheduled_at !== initialWhen
          ? { scheduled_at: fromStoreInput(values.scheduled_at) }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(t.saved);
          onClose();
        },
        onError: (error) => {
          for (const message of applyFieldErrors(error, setError, {
            fields: FIELDS,
            codeFields: {
              INVALID_LINK: "link",
              INVALID_SCHEDULE: "scheduled_at",
            },
          }))
            toast.error(message);
        },
      },
    );
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t.editTitle}</DialogTitle>
      </DialogHeader>
      <FormField
        id="edit-title"
        label={`${c.fields.title} *`}
        error={err("title")}
      >
        <Input id="edit-title" maxLength={200} {...register("title")} />
      </FormField>
      <FormField
        id="edit-body"
        label={`${c.fields.body} *`}
        error={err("body")}
      >
        <Textarea id="edit-body" rows={4} {...register("body")} />
      </FormField>
      <Controller
        control={control}
        name="link"
        render={({ field }) => (
          <LinkTargetField
            id="edit-link"
            value={field.value}
            onChange={field.onChange}
            error={err("link")}
          />
        )}
      />
      <FormField
        id="edit-scheduled"
        label={c.fields.scheduledAt}
        hint={c.scheduleHint}
        error={err("scheduled_at")}
      >
        <Input
          id="edit-scheduled"
          type="datetime-local"
          dir="ltr"
          {...register("scheduled_at")}
        />
      </FormField>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={update.isPending}
        >
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t.saving : t.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
