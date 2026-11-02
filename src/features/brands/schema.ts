import { z } from "zod";

import { isValidSlug } from "@/lib/slug";
import { m } from "@/messages";

const v = m.brands.form.validation;

/** Brand form; limits copied from the backend (name 1-100, description <=5000, sort +-1,000,000). */
export const brandSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    sort_order: z.string(),
    is_own_brand: z.boolean(),
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const name = values.name.trim();
    if (!name) fail("name", v.nameRequired);
    else if (name.length > 100) fail("name", v.nameMax);
    const slug = values.slug.trim();
    if (slug && !isValidSlug(slug)) fail("slug", v.slugInvalid);
    if (values.description.length > 5000) fail("description", v.descriptionMax);
    const sort = values.sort_order.trim();
    if (!/^-?\d+$/.test(sort) || Math.abs(Number(sort)) > 1_000_000)
      fail("sort_order", v.sortOrderInvalid);
  });

export type BrandFormValues = z.infer<typeof brandSchema>;

export const EMPTY_BRAND: BrandFormValues = {
  name: "",
  slug: "",
  description: "",
  sort_order: "0",
  is_own_brand: false,
  is_active: true,
};
