import { m } from "@/messages";

/**
 * Where a banner or a campaign leads when tapped. The backend's catalog link types only
 * (`order`, `admin_order` and `admin_product` are rejected for banners and campaigns).
 * `category`, `product` and `brand` carry a **slug** that must exist; `url` must be https
 * and at most 255 characters; `none`, `new` and `sale` take no value (INVALID_LINK otherwise).
 */
export const LINK_TYPES = [
  "none",
  "product",
  "category",
  "brand",
  "new",
  "sale",
  "url",
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const URL_MAX = 255;

/** A link as the forms hold it: `label` is only what the picker shows (never sent). */
export type LinkValue = { type: LinkType; value: string; label: string };

export const EMPTY_LINK: LinkValue = { type: "none", value: "", label: "" };

/** The link as the backend returns it. */
export type LinkOut = { type: string; value?: string | null };

export function takesValue(type: LinkType): boolean {
  return (
    type === "product" ||
    type === "category" ||
    type === "brand" ||
    type === "url"
  );
}

/** Picking another type clears the value: a product slug is meaningless as a brand. */
export function changeLinkType(link: LinkValue, type: LinkType): LinkValue {
  return type === link.type ? link : { type, value: "", label: "" };
}

/** An error message for an incomplete or invalid link, `null` when it is fine. */
export function validateLink(link: LinkValue): string | null {
  const v = m.link.validation;
  if (!takesValue(link.type)) return null;
  const value = link.value.trim();
  if (link.type !== "url") return value ? null : v.targetRequired;
  if (!value) return v.urlRequired;
  if (value.length > URL_MAX) return v.urlMax;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.host ? null : v.urlInvalid;
  } catch {
    return v.urlInvalid;
  }
}

/** The `{type, value}` the backend takes (value `null` for the value-less types). */
export function toBackendLink(link: LinkValue): {
  type: LinkType;
  value: string | null;
} {
  return {
    type: link.type,
    value: takesValue(link.type) ? link.value.trim() : null,
  };
}

export function isLinkType(type: string): type is LinkType {
  return (LINK_TYPES as readonly string[]).includes(type);
}

/** A saved link as the form shows it; `label` falls back to the slug until it is resolved. */
export function fromBackendLink(link: LinkOut, label?: string): LinkValue {
  const type = isLinkType(link.type) ? link.type : "none";
  const value = link.value ?? "";
  return { type, value, label: label ?? value };
}

/** Looks up the display name of a slug (undefined while unknown or when it does not exist). */
export type NameLookup = (type: LinkType, slug: string) => string | undefined;

/** Human-readable text: "منتج: اسم المنتج", "رابط خارجي: https://…", "قسم التخفيضات". */
export function describeLink(link: LinkOut, name?: NameLookup): string {
  const t = m.link.describe;
  const type = isLinkType(link.type) ? link.type : "none";
  const value = link.value ?? "";
  switch (type) {
    case "none":
    case "new":
    case "sale":
      return t[type];
    case "url":
      return `${t.url}: ${value}`;
    default:
      return `${t[type]}: ${name?.(type, value) ?? value}`;
  }
}
