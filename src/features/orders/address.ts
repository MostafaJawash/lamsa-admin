/**
 * The address stored on an order (`shipping_address`, a free-form object the backend keeps
 * as it was when the order was placed). Orders placed after the Syria adaptation carry
 * `{label, governorate, area, details, latitude, longitude, notes}`; older ones carry
 * `{city, street, building, notes}`, and old pickup orders carry none. Same reading as
 * lamsa-web's `describeAddressSnapshot`, without its OpenStreetMap link: the admin uses the
 * backend's own `map_url` (Google Maps, see the backend README).
 */
export type AddressView = {
  /** Display lines, most important first (label, governorate and area, details). */
  lines: string[];
  notes: string | null;
  hasLocation: boolean;
};

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isCoordinate(value: unknown): boolean {
  const t = text(value);
  return t !== "" && Number.isFinite(Number(t));
}

export function describeAddress(
  snapshot: Record<string, unknown> | null | undefined,
  governorateName: (code: string) => string,
): AddressView | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const notes = text(snapshot.notes) || null;

  if ("governorate" in snapshot || "details" in snapshot) {
    const code = text(snapshot.governorate);
    const place = [code ? governorateName(code) : "", text(snapshot.area)]
      .filter(Boolean)
      .join("، ");
    return {
      lines: [text(snapshot.label), place, text(snapshot.details)].filter(
        Boolean,
      ),
      notes,
      hasLocation:
        isCoordinate(snapshot.latitude) && isCoordinate(snapshot.longitude),
    };
  }

  const lines = ["city", "street", "building"]
    .map((key) => text(snapshot[key]))
    .filter(Boolean);
  return lines.length > 0 || notes
    ? { lines, notes, hasLocation: false }
    : null;
}

/** Customer detail pages do not exist yet; when they do, return their path here. */
export function customerHref(_userId: number): string | null {
  return null;
}
