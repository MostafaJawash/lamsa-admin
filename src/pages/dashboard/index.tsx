import {
  LowStock,
  RecentOrders,
  StatCards,
  TopProducts,
} from "@/features/dashboard";
import { m } from "@/messages";

/** /: the landing page after login. Read-only; every widget loads and fails on its own. */
export function DashboardPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">{m.dashboard.title}</h1>
      <StatCards />
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentOrders />
        <LowStock />
      </div>
      <TopProducts />
    </section>
  );
}
