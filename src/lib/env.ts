import { z } from "zod";

const schema = z.object({
  VITE_API_BASE_URL: z
    .url({
      message: "must be an absolute URL, e.g. http://127.0.0.1:8000/api/v1",
    })
    .transform((value) => value.replace(/\/+$/, "")),
  VITE_MEDIA_BASE_URL: z
    .url({
      message: "must be an absolute URL, e.g. http://127.0.0.1:8000/media",
    })
    .transform((value) => value.replace(/\/+$/, "")),
});

function load() {
  const parsed = schema.safeParse(import.meta.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables (copy .env.example to .env.local):\n${problems}`,
    );
  }
  return {
    API_BASE_URL: parsed.data.VITE_API_BASE_URL,
    MEDIA_BASE_URL: parsed.data.VITE_MEDIA_BASE_URL,
  };
}

/** Validated at startup: a missing or malformed variable stops the app with a clear message. */
export const env = load();
