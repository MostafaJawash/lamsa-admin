import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import { useTestPush } from "../api";

type Props = {
  /** The form's current text; empty values fall back to the backend's default test message. */
  title: string;
  body: string;
};

/**
 * "Try it on your own device first": the backend pushes to the calling admin's devices only
 * (no customer, no inbox row, no history) and reports one result per device.
 */
export function TestPushCard({ title, body }: Props) {
  const t = m.notifications.compose.test;
  const test = useTestPush();
  const result = test.data;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <h2 className="font-semibold">{t.title}</h2>
      <p className="text-sm text-ink-muted">{t.hint}</p>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={test.isPending}
          onClick={() =>
            test.mutate(
              {
                title: title.trim() || undefined,
                body: body.trim() || undefined,
              },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
        >
          {test.isPending ? t.sending : t.button}
        </Button>
      </div>
      {result ? (
        result.devices === 0 ? (
          <p role="status" className="text-sm text-warn">
            {t.noDevices}
          </p>
        ) : (
          <div className="flex flex-col gap-1" role="status">
            <span className="text-sm font-medium">{t.results}</span>
            <ul className="flex flex-col gap-1 text-sm">
              {result.results.map((r) => (
                <li key={r.token} className="flex items-center gap-2">
                  <Badge variant={r.ok ? "default" : "secondary"}>
                    {r.ok ? t.ok : t.failed}
                  </Badge>
                  <bdi dir="ltr" className="text-xs text-ink-muted">
                    {r.token} · {r.code}
                  </bdi>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </section>
  );
}
