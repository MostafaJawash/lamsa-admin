import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import {
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
} from "react-router";

import type { ProductListItem } from "@/features/products";

/** Handlers keyed "METHOD /path" (path without /api/v1); the value builds the JSON reply. */
export type Handler = (request: Request) => { status?: number; body?: unknown };
export type Handlers = Record<string, Handler>;

export type RecordedCall = {
  method: string;
  path: string;
  url: URL;
  body: unknown;
};

/**
 * Replaces `fetch` so the real API client (openapi-fetch, auth wrapper, ApiError mapping)
 * runs against canned replies. Returns the list of calls made.
 */
export function mockBackend(handlers: Handlers): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const text = await input.clone().text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        // not JSON (multipart): keep the text
      }
      calls.push({ method: input.method, path, url, body });
      const handler = handlers[`${input.method} ${path}`];
      if (!handler)
        return new Response(
          JSON.stringify({ error: { code: "NOT_FOUND", message: "no mock" } }),
          { status: 404 },
        );
      const { status = 200, body: reply } = handler(input);
      return new Response(status === 204 ? null : JSON.stringify(reply ?? {}), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

export function renderRoutes(routes: RouteObject[], initial: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initial] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client, ...view };
}

export const urls = {
  thumb: "http://x/t.webp",
  medium: "http://x/m.webp",
  large: "http://x/l.webp",
};

export function listItem(over: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: 1,
    type: "simple",
    currency: "SYP",
    name: "كريم الورد",
    slug: "rose-cream",
    sku: "LM-1",
    category: { id: 3, name: "العناية بالبشرة", slug: "skin" },
    brand: { id: 2, name: "لمسة", slug: "lamsa" },
    image: urls,
    price_from: "15000.00",
    stock: 12,
    in_stock: true,
    is_on_sale: false,
    is_new: false,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as ProductListItem;
}

export const categoriesReply = [
  {
    id: 3,
    name: "العناية بالبشرة",
    slug: "skin",
    parent_id: null,
    children: [],
  },
];

export const categoryDetail = {
  ...categoriesReply[0],
  own_attributes: [],
  own_variant_options: [],
  effective_attributes: [],
  effective_variant_options: [],
};

export const brandsReply = {
  items: [{ id: 2, name: "لمسة", slug: "lamsa" }],
  page: 1,
  page_size: 100,
  total: 1,
};
