import { useLocation } from "react-router";

import { m } from "@/messages";

import { navItems } from "./nav-items";

/** Placeholder: shows the current top-level area. Nested crumbs come with detail pages. */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const current = navItems.find((item) =>
    item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  if (!current) return null;
  return (
    <nav aria-label={m.nav.breadcrumbs} className="text-sm text-ink-muted">
      {current.label}
    </nav>
  );
}
