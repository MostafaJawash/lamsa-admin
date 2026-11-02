# lamsa-admin

Admin dashboard for the Lamsa beauty store. A separate project from the customer website (`../lamsa-web`); both use the same backend (`../lamsa-backend`, FastAPI). Arabic only, right-to-left.

> Status: login and the **Products** page are built (see below). The other pages still show their Arabic title and a placeholder.

## Stack

| Area         | Choice                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------- |
| App          | Vite 8 + React 19 + TypeScript (strict), plain SPA                                                 |
| Routing      | React Router 8, data router (`createBrowserRouter`, route loaders)                                 |
| Server state | TanStack Query (caching, mutations, invalidation)                                                  |
| API          | `openapi-typescript` + `openapi-fetch`, generated from the backend's OpenAPI (same as the website) |
| UI           | Tailwind CSS 4 (`@tailwindcss/vite`) + shadcn/ui (Radix) + lucide icons                            |
| Forms        | react-hook-form + zod                                                                              |
| Tooling      | oxlint, Prettier (+ Tailwind plugin), Vitest + Testing Library, Playwright                         |
| Fonts        | IBM Plex Sans Arabic (body) and Reem Kufi (display), self-hosted through `@fontsource`             |

### Why Vite + React and not Next.js

This is an internal tool behind a login. It needs no SEO, no server rendering and no public caching, so Next.js would add a server, a deployment target and a larger attack surface for no benefit. A static SPA is simpler to build and host, and keeps this dashboard fully isolated from the website: a vulnerability in the customer site can never reach it, because they share nothing but the backend API.

## Running it

Requires Node 24+.

```bash
npm install
cp .env.example .env.local     # then adjust if the backend is elsewhere
npm run dev                    # http://localhost:5173
```

### Backend + admin (+ website)

1. Start the backend as described in `../lamsa-backend/README.md` (`http://127.0.0.1:8000`).
2. **Allow the admin origin in the backend's `.env`** (CORS is configured there, not in this repo), then restart the backend:
   ```
   CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173
   ```
   Without this the browser blocks every call from the dashboard. A production admin origin must be added the same way.
3. Create an admin account once (the password is asked interactively): `python -m scripts.create_admin --name "..." --phone "0933 123 456"` (or `scripts.make_admin` to promote an existing user).
4. `npm run dev` here. To run the website too: `npm run dev` in `../lamsa-web` (port 3000). Ports: backend 8000, website 3000, admin 5173 (`strictPort`: it fails instead of silently taking another port).

### Environment variables

Validated at startup with zod (`src/lib/env.ts`); a missing or malformed value stops the app with a clear message. Only `VITE_*` variables reach the browser, so never put a secret in them.

| Variable              | Example                        | Meaning                                       |
| --------------------- | ------------------------------ | --------------------------------------------- |
| `VITE_API_BASE_URL`   | `http://127.0.0.1:8000/api/v1` | Backend base URL, already including `/api/v1` |
| `VITE_MEDIA_BASE_URL` | `http://127.0.0.1:8000/media`  | Public base of the backend's image files      |

### Scripts

| Script                              | What it does                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `preview` | Vite dev server / `tsc -b` then production build / serve the build                                                                                                          |
| `npm run lint`                      | oxlint (`no-explicit-any` is an error)                                                                                                                                      |
| `npm run typecheck`                 | `tsc -b` (strict, `noUncheckedIndexedAccess`)                                                                                                                               |
| `npm run format` / `format:check`   | Prettier write / check                                                                                                                                                      |
| `npm test`                          | Vitest (`tests/`)                                                                                                                                                           |
| `npm run test:e2e`                  | Playwright (`e2e/`) against the **lamsa_test backend on :8001**; starts its own dev server on :5174 (see _End-to-end tests_). First time: `npx playwright install chromium` |
| `npm run gen:api`                   | Regenerate `src/lib/api/schema.d.ts` from the running backend                                                                                                               |
| `npm run audit`                     | `npm audit --omit=dev --audit-level=high`                                                                                                                                   |

### Regenerating the API types

With the backend running on port 8000:

```bash
npm run gen:api
```

This rewrites `src/lib/api/schema.d.ts` (committed). Run it whenever the backend's API changes, then `npm run typecheck` to find what broke. The client (`src/lib/api/`) strips the `/api/v1` prefix from the generated paths, so you write `api.GET("/admin/orders")`.

## Products (المنتجات)

Routes: `/products` (list), `/products/new` and `/products/:id/edit` (a full page, not a modal). Code: `src/features/products/` (hooks, zod schema, payload mapping, components), `src/pages/products/` (route components). Categories and brands are only _consumed_ here (`features/categories`, `features/brands`; cached 5 minutes); their management pages are a later phase.

**List.** Server-side pagination (`page`/`page_size`=20), and every filter lives in the URL query string (`?page=2&q=…&category=3&brand=2&status=active&type=variable&sort=name`), so back/forward and shared links work. Filters: name/SKU search (debounced), category (includes child categories), brand, status, type. Sort: newest, name, price, lowest stock (all done by the backend). Rows show thumbnail, name/type/SKU, category, brand, price, stock, status and actions (edit, adjust stock for simple products, delete). Delete asks for confirmation and shows the backend's own message when it refuses (`PRODUCT_HAS_ORDERS`, `PRODUCT_IN_BUNDLE`: deactivate instead).

**Product types** (the backend has three): `simple` (price + stock), `variable` (variants only, no top-level price or stock) and `bundle`. The type is chosen on creation and cannot change.

**Form.** react-hook-form + zod; the schema mirrors the backend's Pydantic limits (name 1–200, description ≤20,000, SKU ≤64, slug ≤120, stock 0–1,000,000, price ≤13 digits, sale price lower than price). The product's currency is SYP or USD and is editable (variants inherit it; there is no conversion, so re-enter the prices when changing it). SYP prices are whole pounds in the UI (a convention: the backend accepts 2 decimals for both); USD allows cents. The category decides which **attributes** (text, number, select, multiselect, boolean, date; some required) and **variant options** (color with hex, or select) exist, so those fields are rebuilt from `GET /admin/categories/{id}` when the category changes.

**Save flow.** The backend always creates a product _inactive_. Create therefore does: `POST /admin/products` → upload the chosen images → `PATCH is_active:true` if "نشط" was on. If a later step fails, the product already exists, so the page opens its edit page with the reason (for publishing, the Arabic list from `PRODUCT_NOT_PUBLISHABLE`). Edit does `PATCH` for the product fields and, for variable products, only the _changed_ variants through their own endpoints (delete, patch, add). After a successful save the page returns to the list with a toast. Backend validation errors go onto the field they name (dotted paths such as `variants.0.price`, `INVALID_ATTRIBUTE_VALUE {key}`, `MISSING_REQUIRED_ATTRIBUTE {keys}`, `SKU_TAKEN`, `SLUG_TAKEN`); anything else is a toast. Leaving with unsaved changes asks first (`useBlocker`).

**Stock.** On an existing product, stock is not a form field: "تعديل المخزون" (list and edit page, and per variant) calls the dedicated atomic `stock-adjust` endpoints with a signed delta and optional reason (the backend rejects going below zero). The reason is accepted by the API but no audit trail is stored for it today.

**Images.** Separate endpoints, not part of the product payload. Accepted: JPEG, PNG, WEBP, up to 5 MB each (`MAX_UPLOAD_MB`), at most 15 per product; the picker checks this before uploading and the server stays the authority (`FILE_TOO_LARGE`, `INVALID_IMAGE`, `IMAGE_LIMIT_REACHED`). Files go one request per image, so each succeeds or fails alone, with an "n/m" counter (the fetch API has no byte-level upload progress). On _create_, images are chosen first (reorderable) and uploaded after the product exists. On _edit_, every change applies immediately: upload, delete, reorder (the first image is the main one), alt text, and linking new uploads to one of the product's colors. Upload requests get a 60 s timeout instead of 10 s.

### Known gaps and limits

- **Bundles:** listed and editable for name, price, category/brand, attributes and status only. The bundle-items editor (`PUT /admin/products/{id}/bundle-items`) is not built, and bundles cannot be created from this page. Planned for a later phase.
- **Variant price range** ("من X إلى Y") is shown on the edit page; the list shows "من X" because the list endpoint returns only `price_from`.
- **No bulk actions**, and no category/brand management pages yet.
- Brand selects load the first 100 brands (the backend's page-size cap).
- Image reordering uses earlier/later buttons, not drag-and-drop.
- The stock-adjust `reason` is not stored by the backend.
- A page reload ends the admin session by design, so e2e tests navigate by clicking.

## End-to-end tests

`npm run test:e2e` runs against the **real backend on a separate database**, never the dev one. Start a second backend instance on port 8001 on `lamsa_test` by overriding the environment (no `.env` change), from `../lamsa-backend`:

```powershell
$env:DB_NAME="lamsa_test"; $env:MEDIA_ROOT="<a temp folder>"; $env:MEDIA_URL="http://127.0.0.1:8001/media"
$env:PUSH_BACKEND="log"; $env:CACHE_ENABLED="false"; $env:CORS_ORIGINS="http://127.0.0.1:5174,http://localhost:5174"
.\venv\Scripts\python.exe -m scripts.init_storage
.\venv\Scripts\alembic.exe upgrade head
.\venv\Scripts\python.exe -m scripts.seed_base
.\venv\Scripts\uvicorn.exe app.main:app --port 8001 --no-proxy-headers
```

Playwright starts its own admin dev server on :5174 pointed at it. As in lamsa-web, `e2e/global-setup.ts` registers an `e2e-admin-…` account through the API and promotes it with `scripts.make_admin` (on `lamsa_test`); `global-teardown.ts` deletes every `e2e-` product and that account. The suite refuses to run against port 8000 or a database not ending in `_test`. If the backend on :8001 is down, the product tests skip. Overrides: `E2E_API_BASE_URL`, `E2E_MEDIA_BASE_URL`, `E2E_ADMIN_PORT`, `E2E_DB_NAME`.

## Authentication and token storage

The dashboard calls the backend directly from the browser (no proxy layer: it is an internal tool, not a public site). Login is phone + password (`POST /auth/login`).

- **Tokens live only in memory** (`src/lib/auth/session.ts`): never in `localStorage`, `sessionStorage`, cookies or IndexedDB. Storage that scripts can read means a single XSS bug can steal a 60-day refresh token; memory dies with the tab.
- **Silent refresh while the app is open.** The access token lasts 15 minutes. A timer refreshes it a minute before expiry, and if a call still returns `401 TOKEN_EXPIRED` the client refreshes once and replays the request. Refresh tokens are single-use on the backend, so refreshes are single-flight: any number of callers share one request. If the backend rejects the refresh, the session ends and the user is sent to `/login`.
- **A hard reload (F5, a new tab, closing the browser) means logging in again.** This is deliberate. Without persisted storage there is nothing to restore a session from, and a refresh-token cookie would need backend changes and CSRF protection. For an admin tool whose account can change prices, orders and customers, a full re-login after a reload is the safer tradeoff, at the cost of some convenience.
- **Admins only.** Every route except `/login` needs a session with `user.role === "admin"` (a route loader checks it before rendering, and `AuthGuard` reacts if the session ends later). If a non-admin account logs in, the dashboard revokes the session it just got (`POST /auth/logout`), shows an Arabic error and grants nothing. The backend enforces the same rule independently (`403 ADMIN_ONLY`), so the front end is never the only barrier.
- A temporary password (`must_change_password`) blocks the dashboard with an explanation; changing passwords is not built yet.

## Folder structure

```
src/
  app/          router.tsx (route tree, auth loader + AuthGuard), providers.tsx (Query, Toaster)
  pages/        One folder per admin area; route components that only compose features
  features/     Business logic per domain (queries, mutations, schemas, domain components)
  components/
    layout/     Admin chrome: AppShell, Sidebar, Topbar, Breadcrumbs
    ui/         shadcn/ui output (edited for Arabic text; keep RTL classes)
    shared/     Cross-domain pieces: DataTable, EmptyState, ErrorState, Money, Pager, ConfirmDialog
  lib/
    api/        base.ts (types, errors, bare client), client.ts (authed client), schema.d.ts (generated)
    auth/       session.ts: in-memory tokens, login/logout, single-flight refresh
    money.ts    Currency-aware formatting; per-currency sums, never mixed
    images.ts   srcset helper for the backend's thumb/medium/large WebP
    errors.ts   ApiError + Arabic messages (backend message first)
    env.ts      zod-validated env vars
    utils.ts    cn()
  hooks/        Shared hooks
  messages/     ar.ts: every UI string, typed (Modern Standard Arabic)
  styles/       globals.css: brand tokens, fonts, shadcn mapping
tests/          Vitest setup and unit tests
e2e/            Playwright smoke + products tests
```

## Conventions

- **RTL: logical CSS properties only.** `ms-*`/`me-*`, `ps-*`/`pe-*`, `start`/`end`, `text-start`, `border-s`; never `ml`/`mr`/`left`/`right`. Directional icons (chevrons, arrows) get `rtl:rotate-180`. The shadcn components are generated with `rtl: true`; keep that when adding more (`npx shadcn add <name>`, then check the result and the Arabic text; the CLI leaves some English `sr-only` labels, which we replace with messages).
- **All text comes from `src/messages/ar.ts`.** No literal Arabic (or English) in components. Modern Standard Arabic only, no dialect, matching the backend. Adding English later means a typed `en.ts` and picking the catalog in `messages/index.ts`.
- **Where logic lives.** Pages compose; `features/<domain>` holds TanStack Query hooks, zod schemas and domain components; `lib` holds infrastructure used by everything; `components/shared` holds generic UI. Features do not import each other's internals.
- **Server state is TanStack Query only.** Call the API with `unwrap(api.GET(...))` so failures throw a typed `ApiError`; branch on `error.code`, show `errorMessage(error)` (the backend's own Arabic message first).
- **Money.** Every amount arrives with its currency (SYP or USD) and is shown with `<Money amount currency />` / `formatMoney`. Currencies are never converted or added together; totals use `sumByCurrency`, which returns one bucket per currency.
- **Images.** Plain `<img {...imageProps(urls, sizes)} />`; the backend already serves WebP in 300/800/1600 px. Never re-process on the client.
- **Naming.** Files `kebab-case.tsx`; components `PascalCase`; one default responsibility per file; route components named `<Area>Page`.
- **TypeScript.** Strict, no `any` (lint error). Generated types come from `schema.d.ts`; do not hand-write API types.
- **Line endings and encoding.** UTF-8 without BOM, LF (`.editorconfig`, `.gitattributes`).

## Brand

Colors and fonts are the website's (`../lamsa-web/src/app/globals.css`): the `--lamsa-*` palette with dark mode following the system, mapped onto shadcn's tokens. Use the brand utility names in feature code (`bg-surface`, `text-ink`, `text-ink-muted`, `text-brand`, `border-line`, `text-danger`...). The layout is a standard admin shell (sidebar + topbar + content) and body text is 15 px for denser tables.
