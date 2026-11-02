import { BellIcon } from "lucide-react";

import { LinkText, type LinkOut } from "@/features/banners";
import { m } from "@/messages";

type Props = {
  title: string;
  body: string;
  link: LinkOut;
};

/** What lands on the phone: a notification card with title and body, plus where a tap leads. */
export function PushPreview({ title, body, link }: Props) {
  return (
    <div
      data-testid="push-preview"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <BellIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-semibold break-words">{title}</p>
          <p className="text-sm break-words whitespace-pre-wrap text-ink-muted">
            {body}
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-line pt-2 text-xs text-ink-muted">
        <span className="shrink-0">{m.notifications.send.link}:</span>
        <LinkText link={link} />
      </div>
    </div>
  );
}
