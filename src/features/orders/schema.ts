import { z } from "zod";

import { m } from "@/messages";

/** Backend limits: cancel reason 3-255 characters (required), status note up to 255. */
export const LIMITS = { reasonMin: 3, reasonMax: 255, note: 255 } as const;

export const statusChangeSchema = z.object({
  note: z.string().trim().max(LIMITS.note, m.orders.statusDialog.noteMax),
});

export const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(LIMITS.reasonMin, m.orders.cancel.reasonRequired)
    .max(LIMITS.reasonMax, m.orders.cancel.reasonMax),
  restoreStock: z.boolean(),
});
