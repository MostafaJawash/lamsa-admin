import { NavLink } from "react-router";

import { cn } from "@/lib/utils";
import { m } from "@/messages";

import { navItems } from "./nav-items";

/** The navigation list, shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label={m.nav.mainNavigation} className="flex flex-col gap-1 p-3">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-soft text-ink"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Fixed-width sidebar for large screens (it sits at the inline-start edge: right in RTL). */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-e bg-surface lg:block">
      <div className="flex h-14 items-center border-b px-5">
        <span className="font-display text-2xl font-bold text-brand">
          {m.app.name}
        </span>
      </div>
      <SidebarNav />
    </aside>
  );
}
