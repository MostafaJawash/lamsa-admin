import { z } from "zod";

import { m } from "@/messages";

import {
  attributeNeedsOptions,
  cleanOptions,
  hasDuplicates,
  isValidKey,
  ATTRIBUTE_TYPES,
  VARIANT_OPTION_TYPES,
} from "./definitions";
import { isValidSlug } from "@/lib/slug";

const cv = m.categories.form.validation;
const av = m.categories.attributeDialog.validation;

const integer = /^-?\d+$/;

function validSort(value: string): boolean {
  const text = value.trim();
  return integer.test(text) && Math.abs(Number(text)) <= 1_000_000;
}

/** Category form; limits copied from the backend (name 1-100, description <=5000, sort +-1,000,000). */
export const categorySchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    parent_id: z.string(),
    description: z.string(),
    sort_order: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const name = values.name.trim();
    if (!name) fail("name", cv.nameRequired);
    else if (name.length > 100) fail("name", cv.nameMax);
    const slug = values.slug.trim();
    if (slug && !isValidSlug(slug)) fail("slug", cv.slugInvalid);
    if (values.description.length > 5000)
      fail("description", cv.descriptionMax);
    if (!validSort(values.sort_order)) fail("sort_order", cv.sortOrderInvalid);
  });
export type CategoryFormValues = z.infer<typeof categorySchema>;

export const EMPTY_CATEGORY: CategoryFormValues = {
  name: "",
  slug: "",
  parent_id: "",
  description: "",
  sort_order: "0",
  is_active: true,
};

/** Attribute dialog. `key` is only validated on create (it cannot change afterwards). */
export function buildAttributeSchema(editing: boolean) {
  return z
    .object({
      key: z.string(),
      label: z.string(),
      type: z.enum(ATTRIBUTE_TYPES as [string, ...string[]]),
      options: z.array(z.string()),
      unit: z.string(),
      is_required: z.boolean(),
      is_filterable: z.boolean(),
      sort_order: z.string(),
    })
    .superRefine((values, ctx) => {
      const fail = (path: string, message: string) =>
        ctx.addIssue({ code: "custom", path: [path], message });
      if (!editing && !isValidKey(values.key.trim()))
        fail("key", av.keyInvalid);
      const label = values.label.trim();
      if (!label) fail("label", av.labelRequired);
      else if (label.length > 100) fail("label", av.labelMax);
      if (values.unit.trim().length > 20) fail("unit", av.unitMax);
      if (!validSort(values.sort_order))
        fail("sort_order", av.sortOrderInvalid);
      if (attributeNeedsOptions(values.type as never)) {
        const options = cleanOptions(values.options);
        if (options.length === 0) fail("options", av.optionsRequired);
        else if (hasDuplicates(options)) fail("options", av.optionsDuplicate);
        else if (options.some((option) => option.length > 100))
          fail("options", av.optionMax);
      }
    });
}
export type AttributeFormValues = z.infer<
  ReturnType<typeof buildAttributeSchema>
>;

/** Variant option dialog: a color option has no list; a select option's list is optional. */
export function buildOptionSchema(editing: boolean) {
  return z
    .object({
      key: z.string(),
      label: z.string(),
      type: z.enum(VARIANT_OPTION_TYPES as unknown as [string, ...string[]]),
      options: z.array(z.string()),
      sort_order: z.string(),
    })
    .superRefine((values, ctx) => {
      const fail = (path: string, message: string) =>
        ctx.addIssue({ code: "custom", path: [path], message });
      if (!editing && !isValidKey(values.key.trim()))
        fail("key", av.keyInvalid);
      const label = values.label.trim();
      if (!label) fail("label", av.labelRequired);
      else if (label.length > 100) fail("label", av.labelMax);
      if (!validSort(values.sort_order))
        fail("sort_order", av.sortOrderInvalid);
      if (values.type === "select") {
        const options = cleanOptions(values.options);
        if (hasDuplicates(options)) fail("options", av.optionsDuplicate);
        else if (options.some((option) => option.length > 100))
          fail("options", av.optionMax);
      }
    });
}
export type OptionFormValues = z.infer<ReturnType<typeof buildOptionSchema>>;
