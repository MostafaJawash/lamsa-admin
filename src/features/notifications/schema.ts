import { z } from "zod";

import { validateLink, type LinkType } from "@/features/banners";
import { m } from "@/messages";

import { isScheduleInRange } from "./campaign";

const v = m.notifications.compose.validation;

const linkSchema = z.object({
  type: z.string(),
  value: z.string(),
  label: z.string(),
});

const customerSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
});

/** Compose form; limits copied from the backend (title 1-150, body 1-500, 1 min - 90 days). */
export const composeSchema = z
  .object({
    audience: z.enum(["all", "user"]),
    customer: customerSchema.nullable(),
    title: z.string(),
    body: z.string(),
    link: linkSchema,
    schedule: z.enum(["now", "later"]),
    scheduled_at: z.string(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (values.audience === "user" && !values.customer)
      fail("customer", m.notifications.compose.customerRequired);
    const title = values.title.trim();
    if (!title) fail("title", v.titleRequired);
    else if (title.length > 150) fail("title", v.titleMax);
    const body = values.body.trim();
    if (!body) fail("body", v.bodyRequired);
    else if (body.length > 500) fail("body", v.bodyMax);
    const linkError = validateLink({
      ...values.link,
      type: values.link.type as LinkType,
    });
    if (linkError) fail("link", linkError);
    if (values.schedule === "later") {
      if (!values.scheduled_at) fail("scheduled_at", v.scheduleRequired);
      else if (!isScheduleInRange(values.scheduled_at))
        fail("scheduled_at", v.scheduleRange);
    }
  });

export type ComposeValues = Omit<z.infer<typeof composeSchema>, "link"> & {
  link: { type: LinkType; value: string; label: string };
};

export const EMPTY_COMPOSE: ComposeValues = {
  audience: "all",
  customer: null,
  title: "",
  body: "",
  link: { type: "none", value: "", label: "" },
  schedule: "now",
  scheduled_at: "",
};

/** The edit dialog of a scheduled campaign: no audience (it cannot change), same rules. */
export const editSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    link: linkSchema,
    scheduled_at: z.string(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const title = values.title.trim();
    if (!title) fail("title", v.titleRequired);
    else if (title.length > 150) fail("title", v.titleMax);
    const body = values.body.trim();
    if (!body) fail("body", v.bodyRequired);
    else if (body.length > 500) fail("body", v.bodyMax);
    const linkError = validateLink({
      ...values.link,
      type: values.link.type as LinkType,
    });
    if (linkError) fail("link", linkError);
    if (!values.scheduled_at) fail("scheduled_at", v.scheduleRequired);
  });

export type EditValues = Omit<z.infer<typeof editSchema>, "link"> & {
  link: { type: LinkType; value: string; label: string };
};
