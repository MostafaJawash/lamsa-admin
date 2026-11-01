import { Link } from "react-router";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { m } from "@/messages";

export function NotFoundPage() {
  return (
    <EmptyState title={m.pages.notFound} message={m.pages.notFoundHint}>
      <Button asChild variant="outline" size="sm">
        <Link to="/">{m.pages.backToDashboard}</Link>
      </Button>
    </EmptyState>
  );
}
