/**
 * The backend's `cancelled_rate` is a fraction (0.0833) rounded to 4 decimals. Shown as a
 * percentage with at most two decimals and Latin digits: 0 -> "0٪", 0.0833 -> "8.33٪",
 * 0.5 -> "50٪", 1 -> "100٪". A value that is not a finite fraction shows as "0٪".
 */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return "0٪";
  const percent = Math.round(Math.min(Math.max(rate, 0), 1) * 10000) / 100;
  return `${percent}٪`;
}
