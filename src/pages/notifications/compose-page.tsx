import { ArrowRightIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { ComposeForm } from "@/features/notifications";
import { m } from "@/messages";

/** /notifications/new: compose and send (behind the preview and typed-confirmation gate). */
export function NotificationComposePage() {
  const navigate = useNavigate();
  const t = m.notifications.compose;
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <Link
        to="/notifications"
        className="inline-flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-brand max-md:min-h-11"
      >
        <ArrowRightIcon className="size-4" aria-hidden />
        {t.back}
      </Link>
      <h1 className="font-display text-2xl font-bold">{t.title}</h1>
      <ComposeForm
        onSent={(created) => navigate(`/notifications/${created.id}`)}
      />
    </section>
  );
}
