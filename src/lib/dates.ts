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
