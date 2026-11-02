import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BannersTable, type Banner } from "@/features/banners";
import { BrandsTable } from "@/features/brands";
import { CategoriesTable } from "@/features/categories";
import { CustomersTable, type Customer } from "@/features/customers";
import {
  NotificationsTable,
  type AdminNotification,
} from "@/features/notifications";
import { OrdersTable } from "@/features/orders";
import { ProductsTable } from "@/features/products";

import { listItem, mockBackend } from "./support/backend-mock";
import { brand, categoryTree } from "./support/catalog-fixtures";
import { restoreMatchMedia, setViewportWidth } from "./support/match-media";
import { orderSummary } from "./support/orders-fixtures";

const noop = vi.fn();

const customers = [
  {
    id: 7,
    name: "رنا الأحمد",
    phone: "+963933123456",
    email: "rana@example.com",
    role: "customer",
    auth_provider: "phone",
    must_change_password: false,
    created_at: "2026-11-01T10:30:00Z",
    is_active: true,
    last_login_at: null,
    orders_count: 2,
  },
  {
    id: 8,
    name: "سعاد",
    phone: "+963944000111",
    email: null,
    role: "customer",
    auth_provider: "google",
    must_change_password: false,
    created_at: "2026-10-01T10:30:00Z",
    is_active: false,
    last_login_at: null,
    orders_count: 0,
  },
] as Customer[];

const banners = [
  {
    id: 1,
    title: "عرض الورد",
    subtitle: "خصم 20%",
    image: null,
    link: { type: "product", value: "rose-cream" },
    sort_order: 1,
    is_active: true,
    starts_at: null,
    ends_at: null,
    state: "active",
  },
  {
    id: 2,
    title: "قسم البشرة",
    subtitle: null,
    image: null,
    link: { type: "category", value: "skin-care" },
    sort_order: 2,
    is_active: false,
    starts_at: "2026-12-01T07:00:00",
    ends_at: "2026-12-10T07:00:00",
    state: "scheduled",
  },
] as unknown as Banner[];

const notification = (id: number, over: Partial<AdminNotification> = {}) =>
  ({
    id,
    type: "marketing",
    audience: "all",
    user_id: null,
    user_name: null,
    title: `إشعار ${id}`,
    body: `نص ${id}`,
    link: { type: "none", value: null },
    status: "sent",
    scheduled_at: "2026-11-01T09:00:00",
    sent_at: "2026-11-01T09:00:05",
    created_at: "2026-11-01T08:59:00",
    created_by_user_id: 1,
    created_by_name: "المدير",
    recipients_count: 120,
    success_count: 118,
    failure_count: 2,
    deferred_by_quiet_hours: false,
    ...over,
  }) as AdminNotification;

const CASES: { name: string; element: () => ReactElement }[] = [
  {
    name: "products",
    element: () => (
      <ProductsTable
        rows={[
          listItem({ id: 1 }),
          listItem({
            id: 2,
            name: "عطر",
            type: "variable",
            brand: null,
            is_active: false,
          }),
        ]}
        loading={false}
        emptyMessage=""
        onDelete={noop}
        onAdjustStock={noop}
      />
    ),
  },
  {
    name: "orders",
    element: () => (
      <OrdersTable
        rows={[orderSummary({ id: 101 }), orderSummary({ id: 102 })]}
        loading={false}
        emptyMessage=""
      />
    ),
  },
  {
    name: "customers",
    element: () => (
      <CustomersTable rows={customers} loading={false} emptyMessage="" />
    ),
  },
  {
    name: "categories",
    element: () => (
      <CategoriesTable nodes={categoryTree} loading={false} onDelete={noop} />
    ),
  },
  {
    name: "brands",
    element: () => (
      <BrandsTable
        rows={[
          brand({ id: 1, product_count: 4 }),
          brand({ id: 2, is_own_brand: true, is_active: false }),
        ]}
        loading={false}
        emptyMessage=""
        onEdit={noop}
        onDelete={noop}
      />
    ),
  },
  {
    name: "banners",
    element: () => (
      <BannersTable
        rows={banners}
        loading={false}
        busy={false}
        onEdit={noop}
        onDelete={noop}
        onToggle={noop}
        onMove={noop}
      />
    ),
  },
  {
    name: "notifications",
    element: () => (
      <NotificationsTable
        rows={[
          notification(1),
          notification(2, {
            audience: "user",
            user_name: "رنا",
            status: "cancelled",
          }),
        ]}
        loading={false}
        emptyMessage=""
      />
    ),
  },
];

const text = (node: Element) =>
  (node.textContent ?? "").replace(/\s+/g, " ").trim();
const controls = (node: Element) =>
  Array.from(node.querySelectorAll("a[href], button, [role=switch]"))
    .map(
      (el) =>
        `${el.tagName}|${el.getAttribute("href") ?? ""}|${el.getAttribute("aria-label") ?? text(el)}|${el.getAttribute("aria-checked") ?? ""}|${(el as HTMLButtonElement).disabled}`,
    )
    .sort();

function renderAt(width: number, element: ReactElement) {
  setViewportWidth(width);
  mockBackend({}); // banner link labels look targets up; every call just 404s
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  restoreMatchMedia();
});

describe.each(CASES)("$name list: card layout parity", ({ element }) => {
  it("renders a table from md up and cards below it", () => {
    const desktop = renderAt(1280, element());
    expect(desktop.container.querySelector("table")).not.toBeNull();
    expect(desktop.container.querySelector("li")).toBeNull();
    cleanup();
    const mobile = renderAt(375, element());
    expect(mobile.container.querySelector("table")).toBeNull();
    expect(mobile.container.querySelectorAll("li").length).toBeGreaterThan(0);
  });

  it("shows the same data and the same actions per row on both layouts", () => {
    const desktop = renderAt(1280, element());
    const tableRows = Array.from(
      desktop.container.querySelectorAll("tbody tr"),
    );
    const headers = Array.from(desktop.container.querySelectorAll("th")).map(
      text,
    );
    const expected = tableRows.map((row) => ({
      cells: Array.from(row.querySelectorAll("td")).map(text).filter(Boolean),
      controls: controls(row),
    }));
    cleanup();

    const mobile = renderAt(375, element());
    const cards = Array.from(mobile.container.querySelectorAll("li"));
    expect(cards).toHaveLength(expected.length);
    cards.forEach((card, index) => {
      const want = expected[index];
      const got = text(card);
      for (const cell of want?.cells ?? []) expect(got).toContain(cell);
      expect(controls(card)).toEqual(want?.controls);
    });
    // Field labels in a card are the table's own column headers.
    const labelled = within(mobile.container)
      .queryAllByText(/./, { selector: "dt" })
      .map(text);
    for (const label of labelled) expect(headers).toContain(label);
  });
});

describe("data tables: loading and empty states on mobile", () => {
  it("shows skeleton cards while loading and the empty state when there are no rows", () => {
    const loading = renderAt(
      375,
      <CustomersTable rows={[]} loading emptyMessage="" />,
    );
    expect(
      loading.container.querySelectorAll("[data-testid=skeleton-row]").length,
    ).toBeGreaterThan(0);
    cleanup();
    const empty = renderAt(
      375,
      <CustomersTable rows={[]} loading={false} emptyMessage="لا نتائج" />,
    );
    expect(empty.container.querySelector("li")).toBeNull();
    expect(empty.container).toHaveTextContent("لا نتائج");
  });
});
