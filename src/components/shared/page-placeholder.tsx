import { m } from "@/messages";

/** Every admin page renders this until its feature is built: the Arabic title and a note. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-ink-muted">{m.pages.placeholder}</p>
    </section>
  );
}
