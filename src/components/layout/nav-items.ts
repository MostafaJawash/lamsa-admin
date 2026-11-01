import {
  BellIcon,
  ImageIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagIcon,
  UsersIcon,
  FolderTreeIcon,
  type LucideIcon,
} from "lucide-react";

import { m } from "@/messages";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

/** Sidebar entries, in display order. One per top-level admin area. */
export const navItems: readonly NavItem[] = [
  { to: "/", label: m.nav.dashboard, icon: LayoutDashboardIcon, end: true },
  { to: "/products", label: m.nav.products, icon: PackageIcon },
  { to: "/categories", label: m.nav.categories, icon: FolderTreeIcon },
  { to: "/brands", label: m.nav.brands, icon: TagIcon },
  { to: "/orders", label: m.nav.orders, icon: ShoppingBagIcon },
  { to: "/customers", label: m.nav.customers, icon: UsersIcon },
  { to: "/banners", label: m.nav.banners, icon: ImageIcon },
  { to: "/notifications", label: m.nav.notifications, icon: BellIcon },
  { to: "/settings", label: m.nav.settings, icon: SettingsIcon },
];
