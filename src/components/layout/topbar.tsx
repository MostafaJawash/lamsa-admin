import { useState } from "react";
import { LogOutIcon, MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "@/features/auth";
import { logout } from "@/lib/auth/session";
import { m } from "@/messages";

import { Breadcrumbs } from "./breadcrumbs";
import { SidebarNav } from "./sidebar";

export function Topbar() {
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-surface px-4">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={m.nav.openMenu}
          >
            <MenuIcon />
          </Button>
        </SheetTrigger>
        {/* "right" is the inline-start edge in RTL, where the desktop sidebar sits too. */}
        <SheetContent side="right" className="w-64 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-xl text-brand">
              {m.app.name}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {m.nav.mainNavigation}
            </SheetDescription>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <Breadcrumbs />
      <div className="ms-auto flex items-center gap-2">
        {session.status === "authenticated" ? (
          <span className="hidden text-sm text-ink-muted sm:inline">
            {session.user.name}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOutIcon data-icon="inline-start" className="rtl:-scale-x-100" />
          {m.auth.logout}
        </Button>
      </div>
    </header>
  );
}
