import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlertIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LinkTargetField, toBackendLink } from "@/features/banners";
import { fromStoreInput } from "@/lib/dates";
import { formatDateTime } from "@/lib/dates";
import { applyFieldErrors } from "@/lib/form-errors";
import { m } from "@/messages";

import {
  BroadcastCooldownError,
  useCreateNotification,
  type AdminNotification,
} from "../api";
import { audienceText, buildCreateBody, isBroadcast } from "../campaign";
import { useBroadcastCooldown } from "../cooldown";
import { EMPTY_COMPOSE, composeSchema, type ComposeValues } from "../schema";
import { CustomerPicker } from "./customer-picker";
import { SendDialog, type SendSummary } from "./send-dialog";
import { TestPushCard } from "./test-push-card";

const FIELDS = ["title", "body", "link", "scheduled_at", "customer"];

type Props = {
  /** Called with the campaign the backend accepted (it is sent or scheduled by then). */
  onSent: (created: AdminNotification) => void;
};

/**
 * Compose and send. The real audience options are only "all customers" and "one customer".
 * Nothing is sent from the form itself: "مراجعة وإرسال" opens the SendDialog (preview, and for
 * a broadcast the typed phrase), whose confirmation is the only path to `POST /admin/notifications`.
 */
export function ComposeForm({ onSent }: Props) {
  const t = m.notifications.compose;
  const create = useCreateNotification();
  const cooldown = useBroadcastCooldown();
  const form = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema) as never,
    defaultValues: EMPTY_COMPOSE,
  });
  const { control, register, watch, handleSubmit, setError, formState } = form;
  const [values, setValues] = useState<ComposeValues | null>(null);
  const audience = watch("audience");
  const schedule = watch("schedule");
  const title = watch("title");
  const body = watch("body");
  const broadcast = isBroadcast(audience);
  const err = (field: keyof ComposeValues) =>
    (formState.errors[field] as { message?: string } | undefined)?.message;

  const summary: SendSummary | null = values && {
    audience: values.audience,
    audienceLabel: audienceText({
      audience: values.audience,
      user_name: values.customer?.name,
    }),
    title: values.title.trim(),
    body: values.body.trim(),
    link: toBackendLink(values.link),
    when:
      values.schedule === "later" && values.scheduled_at
        ? formatDateTime(fromStoreInput(values.scheduled_at) ?? "")
        : m.notifications.send.whenNow,
    scheduled: values.schedule === "later",
  };

  const review = handleSubmit((valid) => setValues(valid));

  // mutate() callbacks belong to the latest call only, and isPending lags a render behind a
  // click: this ref is what makes a second click a no-op.
  const submitting = useRef(false);
  const send = () => {
    if (!values || submitting.current) return;
    submitting.current = true;
    create.mutate(
      buildCreateBody({
        audience: values.audience,
        customerId: values.customer?.id ?? null,
        title: values.title,
        body: values.body,
        link: values.link,
        scheduledAt: values.schedule === "later" ? values.scheduled_at : "",
      }),
      {
        onSettled: () => {
          submitting.current = false;
        },
        onSuccess: (created) => {
          toast.success(m.notifications.send.success);
          setValues(null);
          onSent(created);
        },
        onError: (error) => {
          // A second click while the first request is in flight: the first one decides.
          if (error instanceof BroadcastCooldownError) return;
          setValues(null);
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
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        role="alert"
        data-testid="real-send-warning"
        className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4"
      >
        <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-danger" />
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold">{m.notifications.realWarning}</p>
          <p className="text-sm text-ink-muted">
            {m.notifications.realWarningHint}
          </p>
        </div>
      </div>

      <TestPushCard title={title} body={body} />

      <form onSubmit={review} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t.audienceLabel}</legend>
          <Controller
            control={control}
            name="audience"
            render={({ field }) => (
              <div className="flex flex-wrap gap-4">
                {(["all", "user"] as const).map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 text-sm max-md:min-h-11"
                  >
                    <input
                      type="radio"
                      name="audience"
                      value={option}
                      checked={field.value === option}
                      onChange={() => field.onChange(option)}
                    />
                    {m.notifications.audience[option]}
                  </label>
                ))}
              </div>
            )}
          />
          <p className="text-xs text-ink-muted">
            {broadcast ? t.audienceAllHint : t.audienceUserHint}
          </p>
        </fieldset>

        {!broadcast ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{`${t.customer} *`}</span>
            <Controller
              control={control}
              name="customer"
              render={({ field }) => (
                <CustomerPicker
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(err("customer"))}
                />
              )}
            />
            {err("customer") ? (
              <p role="alert" className="text-xs text-danger">
                {err("customer")}
              </p>
            ) : null}
          </div>
        ) : null}

        <FormField
          id="notification-title"
          label={`${t.fields.title} *`}
          error={err("title")}
          hint={`${title.trim().length}/150 ${t.counter}`}
        >
          <Input
            id="notification-title"
            maxLength={200}
            aria-invalid={err("title") ? true : undefined}
            {...register("title")}
          />
        </FormField>
        <FormField
          id="notification-body"
          label={`${t.fields.body} *`}
          error={err("body")}
          hint={`${body.trim().length}/500 ${t.counter}`}
        >
          <Textarea
            id="notification-body"
            rows={4}
            aria-invalid={err("body") ? true : undefined}
            {...register("body")}
          />
        </FormField>

        <Controller
          control={control}
          name="link"
          render={({ field }) => (
            <LinkTargetField
              id="notification-link"
              value={field.value}
              onChange={field.onChange}
              error={err("link")}
            />
          )}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t.fields.schedule}</legend>
          <div className="flex gap-4">
            {(["now", "later"] as const).map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 text-sm max-md:min-h-11"
              >
                <input type="radio" value={option} {...register("schedule")} />
                {option === "now" ? t.fields.now : t.fields.later}
              </label>
            ))}
          </div>
          {schedule === "later" ? (
            <FormField
              id="notification-scheduled"
              label={t.fields.scheduledAt}
              hint={t.scheduleHint}
              error={err("scheduled_at")}
            >
              <Input
                id="notification-scheduled"
                type="datetime-local"
                dir="ltr"
                {...register("scheduled_at")}
              />
            </FormField>
          ) : null}
        </fieldset>

        {broadcast && cooldown.active ? (
          <p role="status" className="text-sm text-warn">
            {t.cooldown} {cooldown.seconds} {t.seconds}
          </p>
        ) : null}
        <div>
          <Button
            type="submit"
            disabled={create.isPending || (broadcast && cooldown.active)}
          >
            {t.review}
          </Button>
        </div>
      </form>

      <SendDialog
        summary={summary}
        pending={create.isPending}
        onConfirm={send}
        onClose={() => setValues(null)}
      />
    </div>
  );
}
