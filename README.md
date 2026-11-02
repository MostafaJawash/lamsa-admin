# lamsa-admin

Admin dashboard for the Lamsa beauty store. A separate project from the customer website (`../lamsa-web`); both use the same backend (`../lamsa-backend`, FastAPI). Arabic only, right-to-left.

> Status: login, **Products**, **Orders**, **Categories**, **Brands** and **Customers** are built (see below). The other pages still show their Arabic title and a placeholder.

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

## Dashboard (لوحة التحكم)

Route: `/`, the **post-login landing page** (login navigates to `/`, `/login` redirects there while signed in, and the sidebar's first entry is it). Code: `src/features/dashboard/`, `src/pages/dashboard/`. **Read-only:** every call is a `GET`; the widgets only link to pages where an admin can act.

### Which real data powers each widget

| Widget                                                                                          | Endpoint                                    | Notes                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Six stat cards: new, preparing, shipped, delivered revenue, average order value, cancelled rate | `GET /admin/orders/stats` (all time)        | `counts{status}`, `delivered_revenue[]`, `average_order_value[]` (one entry per currency, **never summed**), `cancelled_rate` (a 0–1 fraction shown as a percentage). Cards link to `/orders?status=…` in the Orders list's own URL format (revenue and average to `delivered`, the rate to `cancelled`). |
| Top products (best sellers)                                                                     | the same `GET /admin/orders/stats` response | `top_products` (5 by quantity). **Delivered orders only**, so the title says so. A product that no longer exists has no link.                                                                                                                                                                             |
| Low stock                                                                                       | `GET /admin/products/low-stock?page_size=5` | Active simple products and active variants at or below the store's `low_stock_threshold` (no `threshold` param is sent, so the backend's own setting applies), lowest first. "عرض الكل" appears only when `total > 5` and opens `/products?sort=stock_asc`. Rows link to the product's edit page.         |
| Recent orders                                                                                   | `GET /admin/orders?sort=newest&page_size=5` | A simplified row (number, customer, date, status, per-currency totals) linking to the order detail.                                                                                                                                                                                                       |

**Three requests on a fresh load** (stats, low stock, recent orders; the cards and top products share one query), all in parallel, no waterfall. The query keys sit under the existing `["orders", …]` and `["products", …]` prefixes, so changing an order or adjusting stock elsewhere refreshes the widgets, and the stats are the same cache entry the Orders page uses. Each widget has its own skeleton and error state with a retry button, so one failing call never blanks the page. (The stat cards and top products share one query, so they fail and retry together.)

### Considered and deliberately left out

- **No chart:** the backend has no time-series endpoint (no per-day or per-week figures). The only way would be one `/stats` call per day with `date_from`/`date_to`, which is N requests for a decoration, so the page stays with numbers and lists and **no chart library was added**.
- **No date range on the cards:** the cards are all-time (the backend's default); the page says so under them.
- **No customer-growth or notification-performance widget:** the customers list has a total but no date filter, and notification delivery counts exist only per campaign, with no aggregate endpoint.
- `ready_for_pickup` (historical orders only), the total order count and the delivered count are not shown, to keep the row uncluttered.

## Orders (الطلبات)

Routes: `/orders` (list) and `/orders/:id` (detail). Code: `src/features/orders/` (hooks, URL list state, status/address/totals helpers, components), `src/pages/orders/`. Read-and-act only: the backend lets an admin **view an order, move it one step forward, or cancel it**. Nothing else on an order is editable.

### The real status workflow (lamsa-backend `app/modules/orders/workflow.py`)

| Order kind                                              | Forward path (one step at a time)                    |
| ------------------------------------------------------- | ---------------------------------------------------- |
| Delivery (every order today; it has a shipping address) | `pending → preparing → shipped → delivered`          |
| Pickup (historical orders only; the address is `null`)  | `pending → preparing → ready_for_pickup → delivered` |

- An admin moves **exactly one step forward** (`POST /admin/orders/{id}/status {to_status, note?}`). Any other move is `422 INVALID_STATUS_TRANSITION`. The dashboard never decides this itself: it shows one button per entry of the order's `allowed_next_statuses`.
- **Cancelling** is a separate action (`POST /admin/orders/{id}/cancel {reason, restore_stock}`), allowed from `pending`, `preparing`, `shipped` and `ready_for_pickup` (the order's `can_cancel`). `delivered` and `cancelled` are final. The reason is required (3–255 characters). **Stock is restored by default**; `restore_stock=false` ("don't restore", for lost or unreturned goods) is accepted **only for `shipped` orders**, so the checkbox appears only there. A customer can cancel only while `pending`; that is the website's business.
- `delivered` also sets `payment_status` to `paid` (cash on delivery is the only payment method). Each step is recorded in `history` with who made it and the optional note (≤255 characters), and the customer is notified by the backend.
- Labels come from the backend's `status_label` (`delivered` reads "تم التوصيل", or "تم الاستلام" for a pickup order); `ar.ts` mirrors them for the filter and for orders not at hand. The backend README's table says "وصل"; the code says "تم التوصيل", and the code is what is shown.

### List

Server-side pagination (20 per page) and every filter in the URL (`?page=2&q=0933&status=shipped&delivery=damascus_courier&from=2026-10-01&to=2026-10-31&sort=total_desc`). Filters are exactly what `GET /admin/orders` supports: status, delivery method (from `GET /admin/delivery-methods`), UTC date range, search, sort (`newest`, `oldest`, `total_desc`). Search: digits match the order number exactly or part of a phone; other text matches part of the name or phone. Columns: order number, customer name and phone, date (shown in Asia/Damascus), item count, totals, delivery method, status badge, details link. **Totals are one amount per currency, SYP then USD (legacy EUR last), never added together.** A small strip above the list shows the counts of new / preparing / shipped orders from the existing `GET /admin/orders/stats` (all time); clicking a tile filters the list. Badge colors come from the design tokens: neutral = received, amber = preparing, brand = shipped, gold = ready for pickup, green = delivered, red = cancelled.

### Detail

Items (image, name, variant, quantity, unit price and line total in the line's own currency, a link to the product's edit page while the product exists), per-currency subtotal / discount (only if non-zero) / delivery fee / total exactly as the backend stored them, the customer (name, phone, order count; the name becomes a link once a customer page exists: `customerHref()` in `features/orders/address.ts`), the address snapshot as stored (governorate code mapped to its Arabic name through `GET /governorates`, with the code as fallback; old `{city, street, building}` snapshots and pickup orders are handled), a map link, the delivery method with its "fee is paid directly to the carrier" note, payment, customer notes and gift message, a vertical timeline of every workflow step (with the cancel reason), and the history (who, when, note). The status action and the cancel action each open a confirmation dialog, show the backend's own error message, and replace the page with the server's updated order.

### Known gaps and limits

- **No internal admin note, no address or item editing:** the backend has none. The only admin text is the optional note on a status change, kept in the history.
- **Map link:** the backend's `map_url` (Google Maps), as its README specifies for the admin. lamsa-web uses OpenStreetMap on the customer's own pages.
- **Date filters are UTC** (the backend's rule; `date_to` is inclusive), up to three hours off Damascus time; the page says so next to the dates.
- The at-a-glance counters are all-time, not date-filtered. Low stock and the other stats are on the Dashboard (above).
- The customer's name links to their page (`/customers/:id`).

## Categories and brands (الأقسام والماركات)

Routes: `/categories` (tree), `/categories/new`, `/categories/:id/edit`, and `/brands`. Code: `src/features/categories/`, `src/features/brands/` and `src/pages/categories|brands/`. Management only: the **Products page already consumes this data**, and nothing here changes what the backend returns to it.

### The real model (lamsa-backend `app/modules/categories`, `brands`, `products/validation.py`)

**Categories** are a **tree of at most two levels** (`GET /admin/categories` returns the whole nested tree, unpaginated, inactive ones included). A node has `name` (1–100), `slug`, `parent_id`, `description` (≤5000), `sort_order`, `is_active`, `image`, and `product_count` (its own products _plus its children's_).

- **Slug:** `^[a-z0-9]+(-[a-z0-9]+)*$`, 2–120 characters; a taken explicit slug is `409 SLUG_TAKEN`. Left empty, the backend builds one from the name (it transliterates Arabic). The browser cannot, so the form suggests a slug only for latin names and otherwise leaves it empty with a note; editing never rewrites an existing slug.
- **Parent rule** (`CATEGORY_DEPTH_EXCEEDED`): the parent must be a _top-level_ category and not the category itself, and a category that _has children_ cannot be moved under another. That is the whole cycle rule, so the parent select lists top-level categories only (minus the category itself) and is disabled for a category with children. Moving a category re-validates all its products against the new inherited definitions, so a move can be refused with an error naming the product.
- **Delete:** only an empty category; otherwise `409 CATEGORY_NOT_EMPTY {children, products}` and the backend's own message ("أوقفه بدلًا من ذلك"). `is_active` is a real field, so deactivating is the convention.
- **Image:** `PUT`/`DELETE /admin/categories/{id}/image` (one JPEG/PNG/WEBP, ≤5 MB).

**Attributes** (`/admin/categories/{id}/attributes`) describe what a product _is_ (volume, skin type…) and are stored in the product's `attributes` object under their `key`. They are **per-category sub-resources, inherited by child categories** (a child may redefine a key; the child's definition wins). Fields: `key` (`^[a-z][a-z0-9_]{1,49}$`, unique per category, **immutable**), `label` (≤100), `type` (`text`, `number`, `select`, `multiselect`, `boolean`, `date`), `options` (required and non-empty for `select`/`multiselect`, forbidden otherwise), `unit` (≤20), `is_required`, `is_filterable` (storefront filter), `sort_order`.

**Variant options** (`/admin/categories/{id}/variant-options`) are a **separate concept** (not a flag on attributes): they describe how the variants of a _variable_ product differ (color, size…) and are stored in each variant's `options`. Also per-category and inherited. Fields: `key`, `label`, `type` (`color` or `select`), `options`, `sort_order`. A **color** option has no preset list: each product picks a free color name plus a hex value, stored as `<key>_hex`. A **select** option may have a preset list, or none (free text).

**What the backend does when definitions are in use** (this is what the UI handles):

| Change                                                                   | Backend behaviour                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Add an attribute, even a required one                                    | Allowed; existing products are _not_ re-validated (see "Flagged" below)                     |
| Change an attribute's `type` while products use it                       | `409 ATTRIBUTE_IN_USE {key, products_count}`                                                |
| Remove a select value that products use                                  | `409 OPTION_IN_USE {value, products_count}`                                                 |
| Delete an attribute that products use                                    | `409 ATTRIBUTE_IN_USE`, unless `?force=true`, which **removes that key from every product** |
| Change type / remove a value / delete a variant option that variants use | `409 VARIANT_OPTION_IN_USE` / `OPTION_IN_USE {…, variants_count}`; **no force flag**        |

### Categories page

An always-expanded tree list (parents, each followed by its indented children): name with thumbnail, slug, parent, status, product count (a parent's includes its children's), edit and delete. Delete confirms first and shows the backend's message with the child/product counts.

Create and edit are **pages** (the attribute and option editors are rich). **Create saves only the basic fields, then opens the edit page**, because the image, attributes and variant options are sub-resources that need the new category's id (this differs from Products, which returns to the list). The edit page has: the basic fields (explicit Save, back to the list, unsaved-changes prompt), the image (applies immediately), the attributes and the variant options. Each list shows the category's own definitions with edit/delete, and the ones inherited from the parent read-only with a "موروث من القسم الأب" badge and a link to the parent's page. Add/edit use a dialog (key only on create). **Deleting an attribute that products use** shows the backend's refusal, then a separate, clearly worded confirmation ("will remove this value from N products") before the forced delete; variant options simply show the refusal with its count. There is no reorder endpoint: `sort_order` is a plain number, and lists are sorted by it.

### Brands page

Flat and paged (`page`, `q`, `status` in the URL). A brand has `name` (1–100), `slug` (same rules), `description` (≤5000), `is_own_brand`, `is_active`, `sort_order`, a `logo` and a `product_count`. Create/edit is a **dialog** (few fields); a logo chosen while creating is uploaded right after the brand is saved, and on edit it applies immediately. Delete confirms, and a brand with products shows `BRAND_HAS_PRODUCTS` with its count (deactivate instead).

### How Products stays in sync

The category and brand queries are shared with the products form (same query keys), and every mutation here invalidates them and the products lists, so edits show up in Products in the same browser session (otherwise they are cached for five minutes). The category and brand selects in the products form now mark inactive items with "(غير نشط)" (publishing there fails with `CATEGORY_INACTIVE`/`BRAND_INACTIVE`); they are still selectable.

### Flagged, intentionally not changed in Products

- **A required attribute added after products exist.** The backend does not re-validate or unpublish them. Products handles it correctly (editing such a product asks for the new field, and the backend's `MISSING_REQUIRED_ATTRIBUTE` is mapped to it), and an active product keeps selling meanwhile. Nothing to fix; just know that products created earlier are "incomplete" until edited.
- The products **list filter** for category does not mark inactive categories (only the form's selects do).
- Cached categories/brands are shared across tabs only after the five-minute window.
- Moving a category can be refused because one product would become invalid; the backend's message is shown as a toast, and the product id from its details is not surfaced.
- Low-stock, bulk actions and category reordering by drag-and-drop remain out of scope.

## Customers (العملاء)

Routes: `/customers` (list) and `/customers/:id` (detail). Code: `src/features/customers/` (hooks, URL list state, labels, components) and `src/pages/customers/` (the pages also compose the orders feature for the order history and the address). **The Orders detail page's customer name now links here** (`customerHref(userId)` in `features/orders/address.ts` returns `/customers/:id`, and the page uses a router `<Link>`, so the in-memory session survives the click).

### The real account model (lamsa-backend `app/modules/users`, `admin`)

Customers and admins are **one user table**, told apart by `role` (`customer` or `admin`). A record has `name`, `phone` (E.164, unique, not verified: there is no SMS), `email` (optional), `auth_provider` (`phone` = phone + password, or `google` = signs in with Google and has no password), `must_change_password` (set after an admin password reset), `created_at`, `is_active`, `last_login_at` and, in the admin API, `orders_count`.

The admin API is exactly four calls: `GET /admin/users` (`search`, `role`, `is_active`, `page`, `page_size`; **newest first only**; `search` matches part of the **name or phone, not the email**), `GET /admin/users/{id}`, `PATCH /admin/users/{id} {is_active?, role?}` and `POST /admin/users/{id}/reset-password`.

What the backend does **not** give an admin: a customer's saved addresses (those exist only under `/users/me/addresses`, for the signed-in user), a per-customer orders endpoint (`GET /admin/orders` has no customer filter), a lifetime value or "last order" field, or any way to edit a customer's name, phone or email.

### What an admin can do (and what this page deliberately does not)

- **Deactivate / activate** (`PATCH is_active`), each behind a confirmation. Deactivating revokes all the customer's refresh tokens and blocks their access token immediately; login then fails with `403 ACCOUNT_DISABLED`. **Nothing else changes:** orders, addresses and the cart are untouched (the customer simply cannot sign in or order until reactivated). An admin cannot deactivate themselves (`CANNOT_MODIFY_SELF`).
- **Reset password** (phone accounts only; Google accounts have no password and the page says so). This hands over a **live credential**, so after the normal dialog the admin must also **type the word «تأكيد»** before the button activates. The backend returns a 10-character temporary password **once**; the page shows it in a dialog (with a copy button) and keeps it in memory only: it is not cached by the query client (`gcTime: 0`), not logged and not stored, and it is cleared when the dialog closes. All the customer's sessions end and they must change it at next login (the profile then shows a "temporary password pending" badge).
- **Not built, on purpose:** changing a user's `role`. `PATCH role` exists (it can promote or demote anyone), but managing who has admin access is security-sensitive and deserves its own explicit phase. This page is **scoped to `role=customer`**: the list always sends `role=customer` and has no role filter, so admins never appear, and opening `/customers/:id` for an admin's id shows the profile read-only with a notice and **no actions, orders or address lookups**. No editing of customer details is offered because the backend has no endpoint for it.

### List

Server-side pagination (20 per page); page, search and status are in the URL. Columns: name, phone, email (or "—"), registration date (Damascus time), order count (it comes with each row, so there are no per-row calls), account type, status and a details link. There is no sort control because the backend has only "newest first".

### Detail

- **Profile:** name, phone, email, registration date, **last login**, account type, status, order count, and the temporary-password badge.
- **Order history:** found by searching `GET /admin/orders` for the customer's **phone digits** (a phone is unique, so this returns exactly their orders), newest first and paged, reusing the orders table (without the customer column): number, date, per-currency totals (never summed), status badge, each linking to the order. **Limitation:** the phone stored on an order is the one at the time it was placed, so orders from before a customer changed their number do not match. The page says so.
- **Address:** because the live addresses are not exposed to admins, the page shows **the delivery address stored on the customer's latest order** (one extra request for that order), labelled "عنوان آخر طلب" with a note that it is an order's frozen snapshot and not the customer's current saved addresses.
- **Actions:** as above, in a separate card.
- A bad or unknown id shows a not-found state.

## Banners (البانرات)

### The real model (lamsa-backend `app/modules/banners`, `notifications/links.py`)

- **Fields:** a mandatory **image** (JPEG, PNG or WEBP, up to 5 MB), **title** (1-150), optional **subtitle** (≤255), a **link** `{type, value}`, an **active** switch, an optional **window** (`starts_at` / `ends_at`, UTC; the end must be after the start) and a computed **state**: `inactive`, `scheduled`, `active` or `expired`. There is no "publishable" rule like products have: the image is required at creation, so there is nothing to block on.
- **Flat list, no paging.** `GET /admin/banners` returns every banner in display order. The storefront shows at most **10**: active ones inside their window, in that order, skipping a banner whose link target is hidden (the page says so).
- **Order is one call, not a number.** `PUT /admin/banners/order` takes **every** id exactly once (`BANNER_ORDER_MISMATCH` otherwise). The page therefore has up/down buttons that send the full new order, and no numeric sort field (unlike categories and brands). A new banner goes last.
- **Link types an admin can save** (the "catalog" types, shared with notification campaigns): `none`, `product`, `category`, `brand`, `new`, `sale`, `url`. `product` / `category` / `brand` carry a **slug** (not an id) that must exist; `url` must be **https** and ≤255 characters; `none`, `new` and `sale` take no value. Anything else is `INVALID_LINK` (422). `order`, `admin_order` and `admin_product` exist in the enum but are rejected here.

### The page (`/banners`)

- **List:** thumbnail, title (+ subtitle), the link as readable text (**"منتج: اسم المنتج"**, "قسم: …", "ماركة: …", "رابط خارجي: https://…", "قسم الجديد", "قسم التخفيضات", "بدون رابط"), state badge, date range (store time, Damascus), an active switch, up/down, edit, delete.
- **Names from slugs:** categories and brands come from the admin lists already cached for Products (inactive ones included). A product has no lookup by slug in the admin API, so the **public** `GET /products/{slug}` is used. It only answers for products the store shows, so a 404 there also drives a note, "وجهة الرابط غير ظاهرة في المتجر", on banners whose product, category or brand is hidden or gone. The backend still lets an admin save such a link, so this is a warning, never a block.
- **Create/edit is a dialog** (a small field set; the link picker is the only complex part). The **link-target picker** is a type select plus, per type: a debounced server search over `GET /admin/products` for products, an in-memory searchable list of the cached categories or brands, a plain https input for external links, and nothing for new / sale / none. Changing the type clears the value. The picker returns the slug; editing shows the target's name again.
- **Image:** same conventions as category and brand images (`ImageField`: type and 5 MB checked in the browser, the server stays the authority). A new banner needs one (sent in the multipart create); on an existing banner a replacement uploads immediately (`PUT /{id}/image`). There is no "remove": a banner always has an image.
- **Validation and errors:** title/subtitle limits, https URL, a chosen target and end-after-start are checked client-side; `INVALID_LINK` and field errors from the backend land on the field.
- **Delete** asks first. Activating/deactivating is one switch (a `PATCH` of `is_active` only).

## Notifications (الإشعارات)

### What the backend really offers (lamsa-backend `app/modules/notifications`, `integrations/firebase/push.py`)

This is **both** a compose-and-send feature **and** a history, and the send is **real**:

- `POST /admin/notifications {audience, user_id?, title (≤150), body (≤500), link?, scheduled_at?}` creates a campaign. **The audience is only `all` (marketing, to every customer) or `user` (a message to one customer).** There are **no segments** (no abandoned-cart, no lists of ids), and the UI does not pretend otherwise. The link takes the same catalog types as banners. No `scheduled_at` means **immediate** (queued, then pushed in the background right after the request commits); otherwise 1 minute to 90 days ahead. Marketing respects quiet hours (it is deferred to the end of the window and flagged `deferred_by_quiet_hours`) and users' marketing preferences.
- `GET /admin/notifications` is the **history**: paginated, newest first, filterable by `status` (queued, scheduled, sending, sent, cancelled) and `audience`; each row has `recipients_count`, `success_count`, `failure_count`. `GET /admin/notifications/{id}` is one campaign. While a campaign is still `scheduled`: `PATCH` (title, body, link, time), `POST /{id}/cancel` and `POST /{id}/send-now` (ignores quiet hours); anything else is 409.
- `POST /admin/notifications/test {title?, body?}` pushes to **the calling admin's own devices only** (no inbox row, no history) and returns a result per device.
- Real pushes: `PUSH_BACKEND=firebase` (as in `lamsa-backend/.env`, i.e. the **dev backend on :8000**) sends through FCM to real devices; `PUSH_BACKEND=log` only logs. **The backend has no safeguards of its own for a broadcast**: no recipient count, no confirmation, no rate limit, no idempotency key, and a sent push cannot be recalled. The only brake is quiet hours.

### Pages and the safeguards built around sending

- `/notifications`: the history table (date, title and body preview, audience, status with a "deferred" note, delivery numbers once sent), filters and paging in the URL. Rows open `/notifications/:id`: the preview, link, who created it, the delivery numbers (refreshed every 3 s while queued or sending) and, for a scheduled campaign, edit, cancel and send now.
- `/notifications/new` (compose): the **static warning "هذا الإجراء يرسل إشعارات حقيقية"** at the top (always, whatever the environment: the admin UI cannot tell whether the backend it talks to pushes for real), then:
  1. **"Try it on your own device first":** the test push, with copy saying it never reaches a customer.
  2. The audience (**all** or **one customer**, picked from the active customers by name or phone), title and body (with counters), a link (the same picker as banners), send now or schedule (store time, checked against the 1 minute to 90 days window).
  3. **"مراجعة وإرسال" never sends.** It opens the **send dialog**, which shows the push exactly as it will arrive, who gets it ("جميع العملاء": there is no count endpoint, so it is described, not counted) and when. A message to **one customer** needs a plain confirmation (its blast radius is one person). A **broadcast** additionally needs the admin to **type the phrase "إرسال للجميع"** before the button enables (same pattern as the customers' password reset; Enter in the box cannot bypass it), next to a red warning that it cannot be recalled.
  4. **30-second broadcast lock** (client-side only, because the backend has no idempotency key): once the backend accepts a broadcast (create, scheduled, or "send now" of a scheduled broadcast), the review/send controls stay disabled for 30 s with a countdown. It is also enforced in the mutation, synchronously: only one broadcast request can be in flight and a second is refused before it reaches the network, so a double click cannot double-send (a test caught that React's `isPending` lags behind a very fast second click). The lock lives in memory at module level, so leaving and re-opening the page does not reset it; a full reload does. Messages to one customer are not locked.
- **Not built, because the backend has no such thing:** segments, an audience size, drafts, deleting a campaign, resending.

### Testing, and why e2e never does a real send

- Unit and component tests use a **mocked `fetch`** only: nothing in them can reach a backend, so nothing can reach a device. They cover the phrase gate (disabled until it matches, exact payload, one request on a double click), the single-customer path, scheduling, the cooldown (including the unlock after 30 s) and the mutation-level guard.
- **E2E (`e2e/notifications.spec.ts`) mocks the notifications API in the browser** (`page.route` fulfills every `/admin/notifications…` request itself and never calls `route.continue()`), so **no request to those endpoints reaches any backend, not even lamsa_test**. It proves the button stays disabled until the phrase is typed, the exact payload that would be sent, the preview and the 30 s lock. **It deliberately does not cover a real send:** `PUSH_BACKEND` of the running :8001 instance was not verified (the README's start command sets `log`, but the machine's `lamsa-backend/.env` says `firebase`), and being wrong would push to real phones. The banners e2e is real (banners cannot push).

## Responsive layout (phone, tablet, desktop)

The admin is Arabic/RTL throughout, and every screen works from 375px up. Staff mostly use it on a desktop, so the desktop layout is the reference and the phone layout is "complete and usable", not a redesign. Every action available on desktop is also reachable on a phone.

### Breakpoints (Tailwind defaults)

| Width                   | What changes                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| below `md` (< 768px)    | Data tables become stacked cards. Buttons, inputs, selects, switches, checkbox/radio labels and in-card links are at least 44×44px (`max-md:` classes). Filter controls are full width. |
| `md`-`lg` (768-1023px)  | Tables again, scrolling inside their own container with the actions column pinned. Compact desktop sizing. Sidebar still behind the hamburger.                                          |
| `lg` and up (>= 1024px) | The fixed 240px sidebar replaces the hamburger menu.                                                                                                                                    |

`sm` (640px) is used only for two-column forms and dialog footers (stacked below it).

### Sidebar

`Sidebar` (`components/layout/sidebar.tsx`) is the visible desktop sidebar from `lg`. Below that, the topbar shows a hamburger that opens the same `SidebarNav` in a sheet from the inline-start edge (right in RTL); choosing a link closes it. The sidebar and the sheet render the same `navItems`, and a test asserts that.

### Tables: stacked cards below `md`

All seven lists (products, orders, customers, categories, brands, banners, notification history) use `DataTable`. Below `md` it renders one card per row **from the same column definitions** as the table, so the data and every action are identical by construction (`tests/data-tables-mobile.test.tsx` checks the card against the table cell by cell, including links, buttons and switches). Each column may carry a `mobile` role: `media` (thumbnail), `title` (headline, the main link) or `actions` (button row at the bottom of the card); every other column becomes a labelled field. The layout switch is `useIsMobile()` (`hooks/use-media-query.ts`, `matchMedia`), which is `false` where `matchMedia` does not exist (jsdom), so existing tests keep rendering tables.

From `md` up they stay tables. The wrapper scrolls horizontally inside the page (never the page itself), the actions column is pinned with `sticky end-0`, and name/message cells wrap instead of forcing a wide row. Why cards for all seven: each has few enough fields to scan as a card, and a scrolling table starts at the right edge in RTL, which hid the actions at the far left.

The order lists inside a customer's page use the same component, so they switch too. The dashboard widgets were already lists and only needed touch-sized links.

### Forms and dialogs

- Grids declare `grid-cols-1` on mobile. Without it a CSS grid's single implicit column is as wide as its widest content, which stretched the layout viewport (the order page was 401px wide at 375px, which also pushed the cancel and status dialogs off the screen).
- Selects truncate long labels (`min-w-0`, `max-w-full`), so a long category name cannot widen a form.
- Form dialogs already cap at `90svh` and scroll; they stay centered dialogs on phones rather than becoming full-screen sheets, because none was cramped once the fields stacked.
- Variant editor: each variant is a bordered card; options, size and colour stack, price and sale price sit side by side, and stock (with its adjust button) and SKU take a full row for an existing variant.
- Category attributes and variant options keep their list rows (name, key and badges wrap; edit/delete stay as 44px icon buttons).

### Typed-confirmation flows

Customer reset-password and the notification broadcast dialog got only the generic touch sizing (44px inputs and buttons) and the width fix above. Their logic and wording are untouched. The phone e2e checks that each dialog sits fully inside the viewport and that the confirm button stays disabled until the exact phrase is typed (it never clicks it).

### Where this is "usable, not ideal" (honest limits)

- **Portrait tablets (768px+) keep desktop sizing**: 28-32px controls and a scrolling table. The 44px rule applies below `md` only, by decision. If touch tablets matter, switch the `max-md:` size classes in `components/ui` to a custom variant that also matches `(pointer: coarse)`.
- **Switches** stay 18px tall visually; their tap area is extended to about 46px with an invisible overlay (verified in the layout, not by a rendered 44px box).
- **Form dialogs** scroll instead of pinning their footer, so on a short phone the Save button is reached by scrolling.
- **Dev-only**: TanStack Query's devtools button floats at the bottom-left in development builds only.
- The date pickers in the orders filter use the browser's native date control, so their appearance is the browser's.

### Tests

`tests/data-tables-mobile.test.tsx` (card/table parity), `tests/app-shell-mobile.test.tsx` (hamburger and sheet), and `e2e/mobile.spec.ts`, run by the `mobile` Playwright project (Chromium at 375x667 with touch; the iPhone SE profile would need WebKit): login, hamburger and navigation, products list, product edit and save, and the two typed-confirmation gates (the broadcast API mocked in the browser as in the notifications spec).

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

Orders are created through the real customer flow (an `e2e-ord-` category and product made with the admin API, an `e2e-` customer who adds it to the cart and checks out; `e2e/support/orders.ts`). The backend has no order deletion, a product in an order cannot be deleted, and an account with orders is only anonymised, so **order cleanup is SQL-assisted**: every order id the run creates is recorded in a temp file (`lamsa-admin-e2e-orders.jsonl`), and `global-teardown.ts` deletes exactly those rows (items, totals and history cascade) with a small script run in the backend's venv, which asserts the database name ends in `_test`. Customers, products and the category are then removed through the API. A crashed run's record file is swept by the next run's setup. The customers spec (`e2e/customers.spec.ts`) reuses the same real-customer fixture and the same cleanup; the teardown reactivates a customer a test left deactivated before deleting the account (an inactive customer cannot log in to delete themselves). The catalog spec (`e2e/catalog.spec.ts`) creates `e2e-` categories, attributes, variant options and brands through the UI and creates a product in the new category to check that its required attribute and color option appear; it needs no SQL (no orders), only the API sweep in `global-teardown.ts`.

The dashboard spec (`e2e/dashboard.spec.ts`) reuses the same order fixture, drops that product's stock to 0 with the stock-adjust endpoint so it shows in the low-stock widget, and asserts the stat cards, the pre-filtered click-through, the product and order links, and that a fresh load fires exactly the three data requests.

The banners spec (`e2e/banners.spec.ts`) makes an active `e2e-` product with an image through the API, creates a banner linked to it through the UI (checking the readable "منتج: …" text and what the backend stored), edits its link, toggles it and deletes it; banners are swept by title prefix. The notifications spec never touches a real send (see Notifications above).

Playwright starts its own admin dev server on :5174 pointed at it. As in lamsa-web, `e2e/global-setup.ts` registers an `e2e-admin-…` account through the API and promotes it with `scripts.make_admin` (on `lamsa_test`); `global-teardown.ts` deletes every `e2e-` product and that account. The `mobile` project runs `e2e/mobile.spec.ts` at phone width (see Responsive layout). The suite refuses to run against port 8000 or a database not ending in `_test`. If the backend on :8001 is down, the product tests skip. Overrides: `E2E_API_BASE_URL`, `E2E_MEDIA_BASE_URL`, `E2E_ADMIN_PORT`, `E2E_DB_NAME`.

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
e2e/            Playwright smoke, dashboard, products, orders, catalog, customers, banners and notifications (mocked API) tests
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
