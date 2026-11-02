/**
 * Store time is Asia/Damascus (the backend stores UTC). Latin digits, `dd/mm/yyyy hh:mm`,
 * like the rest of the dashboard.
 */
const FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Damascus",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `iso` is a backend timestamp; a value that is not a date is returned unchanged. */
export function formatDateTime(iso: string): string {
  const value = new Date(
    iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`,
  );
  return Number.isNaN(value.getTime())
    ? iso
    : FORMAT.format(value).replace(",", "");
}

const ZONE = "Asia/Damascus";
const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock time in the store's zone for an instant, read back as if it were UTC. */
function zonedAsUtc(ms: number): number {
  const parts = Object.fromEntries(
    PARTS.formatToParts(new Date(ms)).map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  return Date.UTC(
    parts.year as number,
    (parts.month as number) - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** A backend timestamp as the value of a `datetime-local` input, in store time. */
export function toStoreInput(iso: string): string {
  const instant = new Date(
    iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`,
  );
  if (Number.isNaN(instant.getTime())) return "";
  return new Date(zonedAsUtc(instant.getTime())).toISOString().slice(0, 16);
}

/** The reverse: a `datetime-local` value typed in store time, as a UTC ISO string. */
export function fromStoreInput(local: string): string | null {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(local)) return null;
  const guess = Date.parse(`${local}:00Z`);
  if (Number.isNaN(guess)) return null;
  return new Date(guess - (zonedAsUtc(guess) - guess))
    .toISOString()
    .replace(".000Z", "Z");
}
