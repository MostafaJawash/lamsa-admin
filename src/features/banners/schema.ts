import { z } from "zod";

import { fromStoreInput } from "@/lib/dates";
import { m } from "@/messages";

import { validateLink, type LinkType, type LinkValue } from "./link";

const v = m.banners.form.validation;

const linkSchema = z.object({
  type: z.string(),
  value: z.string(),
  label: z.string(),
});

/** Banner form; limits copied from the backend (title 1-150, subtitle <=255). */
export const bannerSchema = z
  .object({
    title: z.string(),
    subtitle: z.string(),
    link: linkSchema,
    is_active: z.boolean(),
    starts_at: z.string(),
    ends_at: z.string(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const title = values.title.trim();
    if (!title) fail("title", v.titleRequired);
    else if (title.length > 150) fail("title", v.titleMax);
    if (values.subtitle.trim().length > 255) fail("subtitle", v.subtitleMax);
    const linkError = validateLink({
      ...values.link,
      type: values.link.type as LinkType,
    });
    if (linkError) fail("link", linkError);
    const starts = values.starts_at ? fromStoreInput(values.starts_at) : null;
    const ends = values.ends_at ? fromStoreInput(values.ends_at) : null;
    if (values.starts_at && !starts) fail("starts_at", v.datesInvalid);
    if (values.ends_at && !ends) fail("ends_at", v.datesInvalid);
    if (starts && ends && Date.parse(ends) <= Date.parse(starts))
      fail("ends_at", v.endsBeforeStart);
  });

export type BannerFormValues = Omit<z.infer<typeof bannerSchema>, "link"> & {
  link: LinkValue;
};

export const EMPTY_BANNER: BannerFormValues = {
  title: "",
  subtitle: "",
  link: { type: "none", value: "", label: "" },
  is_active: true,
  starts_at: "",
  ends_at: "",
};
