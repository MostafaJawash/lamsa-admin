import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  assertTestTarget,
  BACKEND_DIR,
  call,
  deleteAccount,
  deleteProductsByPrefix,
  E2E_DB_NAME,
  registerViaApi,
  uniquePhone,
  uploadProductImage,
} from "./backend.ts";

/**
 * Orders are placed through the real customer API (as lamsa-web's e2e does): an `e2e-`
 * category and product are created through the admin API, an `e2e-` customer adds it to
 * the cart and checks out.
 *
 * The backend cannot delete orders, and a product that is in an order cannot be deleted,
 * so cleanup is SQL-assisted and hard-guarded: only the order ids this run recorded are
 * deleted (items, totals and history cascade), only on a database whose name ends in
 * `_test`; customers, the product and the category then go through the normal API.
 */
export const STATE_FILE = join(tmpdir(), "lamsa-admin-e2e-orders.jsonl");

type Tracked =
  | { kind: "order"; id: number }
  | { kind: "customer"; phone: string }
  | { kind: "category"; id: number };

export function track(record: Tracked): void {
  appendFileSync(STATE_FILE, `${JSON.stringify(record)}\n`);
}

function recorded(): Tracked[] {
  if (!existsSync(STATE_FILE)) return [];
  return readFileSync(STATE_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Tracked);
}

const DELETE_ORDERS = `
import asyncio, json, sys
from sqlalchemy import bindparam, text
from app.core.config import settings
from app.db.session import SessionLocal, engine

assert settings.DB_NAME.endswith("_test"), f"refusing to touch {settings.DB_NAME}"

async def main():
    ids = [int(i) for i in json.loads(sys.argv[1])]
    try:
        async with SessionLocal() as session:
            stmt = text("DELETE FROM orders WHERE id IN :ids").bindparams(bindparam("ids", expanding=True))
            result = await session.execute(stmt, {"ids": ids})
            await session.commit()
            print(result.rowcount)
    finally:
        await engine.dispose()

asyncio.run(main())
`;

/** Deletes exactly these orders (and what cascades from them) in the test database. */
export function deleteOrdersInTestDb(ids: readonly number[]): void {
  assertTestTarget();
  if (ids.length === 0) return;
  execFileSync(
    resolve(BACKEND_DIR, "venv/Scripts/python.exe"),
    ["-c", DELETE_ORDERS, JSON.stringify(ids)],
    {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        DB_NAME: E2E_DB_NAME,
        DEBUG: "false",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: "pipe",
    },
  );
}

/**
 * Removes everything the recorded runs created, in dependency order: orders (SQL), then
 * customers, then products and categories (API). Also sweeps a crashed earlier run, whose
 * file is still there. Never throws: cleanup problems must not hide test results.
 */
export async function cleanupRecorded(adminToken: string): Promise<void> {
  const records = recorded();
  try {
    deleteOrdersInTestDb(
      records.flatMap((r) => (r.kind === "order" ? [r.id] : [])),
    );
  } catch (error) {
    console.warn("e2e cleanup: could not delete orders", error);
    return; // keep the file so the next run retries
  }
  for (const r of records)
    if (r.kind === "customer") await deleteAccount(r.phone);
  try {
    await deleteProductsByPrefix(adminToken, "e2e-ord-");
  } catch {
    // nothing to sweep
  }
  for (const r of records) {
    if (r.kind !== "category") continue;
    try {
      await call("DELETE", `/admin/categories/${r.id}`, { token: adminToken });
    } catch {
      // already gone
    }
  }
  rmSync(STATE_FILE, { force: true });
}

export type Fixture = {
  productId: number;
  productName: string;
  customerName: string;
  orderIds: number[];
  productToken: string;
};

type Quote = { code: string; totals: { currency: string; amount: string }[] };

/** An active `e2e-ord-` product (stock 10, 10,000 SYP) and a customer who places `orders` COD orders of it. */
export async function createOrders(
  adminToken: string,
  stamp: number,
  orders = 2,
): Promise<Fixture> {
  const category = await call<{ id: number }>("POST", "/admin/categories", {
    token: adminToken,
    body: { name: `e2e-ord-قسم-${stamp}` },
  });
  track({ kind: "category", id: category.id });

  const productName = `e2e-ord-منتج-${stamp}`;
  const product = await call<{ id: number }>("POST", "/admin/products", {
    token: adminToken,
    body: {
      type: "simple",
      currency: "SYP",
      name: productName,
      category_id: category.id,
      price: "10000",
      stock: 10,
    },
  });
  await uploadProductImage(adminToken, product.id);
  await call("PATCH", `/admin/products/${product.id}`, {
    token: adminToken,
    body: { is_active: true },
  });

  const phone = uniquePhone();
  const customerName = `e2e-cust-${stamp}`;
  track({ kind: "customer", phone });
  const customer = await registerViaApi(customerName, phone);
  const token = customer.access_token;
  const address = await call<{ id: number }>("POST", "/users/me/addresses", {
    token,
    body: {
      label: "البيت",
      governorate: "damascus",
      area: "المزة",
      details: "شارع الجلاء، بناء 12",
      latitude: "33.5138",
      longitude: "36.2765",
    },
  });

  const orderIds: number[] = [];
  for (let n = 0; n < orders; n++) {
    await call("POST", "/cart/items", {
      token,
      body: { product_id: product.id, variant_id: null, quantity: 1 },
    });
    const cart = await call<{ delivery_quotes: Quote[] }>(
      "GET",
      "/cart?governorate=damascus",
      { token },
    );
    const quote = cart.delivery_quotes.find(
      (q) => q.code === "damascus_courier",
    );
    if (!quote) throw new Error("no damascus_courier quote");
    const order = await call<{ id: number }>("POST", "/orders", {
      token,
      body: {
        delivery_method_code: "damascus_courier",
        address_id: address.id,
        expected_totals: Object.fromEntries(
          quote.totals.map((t) => [t.currency, t.amount]),
        ),
      },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    track({ kind: "order", id: order.id });
    orderIds.push(order.id);
  }
  return {
    productId: product.id,
    productName,
    customerName,
    orderIds,
    productToken: adminToken,
  };
}
