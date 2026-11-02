import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

/**
 * Direct calls to the backend for test setup and cleanup only, following lamsa-web's e2e
 * convention (`../lamsa-web/e2e/support/backend.ts`): throw-away accounts named "e2e-…",
 * an admin made with the backend's own `scripts.make_admin`, everything deleted in teardown.
 *
 * The e2e backend is a SECOND instance (port 8001) on the `lamsa_test` database, never the
 * dev database; see README "End-to-end tests".
 */
export const API =
  process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8001/api/v1";
export const E2E_DB_NAME = process.env.E2E_DB_NAME ?? "lamsa_test";
export const BACKEND_DIR = resolve(process.cwd(), "../lamsa-backend");
export const PASSWORD = "E2e-pass-1234";

export class BackendError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

/** Refuses to run against the dev backend (port 8000) or a non-test database. */
export function assertTestTarget(): void {
  const port = new URL(API).port;
  if (port === "8000" || !E2E_DB_NAME.endsWith("_test"))
    throw new Error(
      `Refusing to run e2e against ${API} / database ${E2E_DB_NAME}: use the lamsa_test backend on port 8001.`,
    );
}

export async function call<T>(
  method: string,
  path: string,
  {
    token,
    body,
    headers,
  }: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      (json as { error?: { code?: string } } | null)?.error?.code ?? "HTTP";
    throw new BackendError(response.status, code);
  }
  return json as T;
}

export async function backendUp(): Promise<boolean> {
  try {
    const response = await fetch(`${API.replace(/\/api\/v1$/, "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export function uniquePhone(): string {
  return `+96393${randomInt(1_000_000, 9_999_999)}`;
}

type TokenPair = { access_token: string; user: { id: number } };

export function registerViaApi(
  name: string,
  phone: string,
): Promise<TokenPair> {
  return call("POST", "/auth/register", {
    body: { name, phone, password: PASSWORD },
  });
}

export function loginViaApi(
  phone: string,
  password = PASSWORD,
): Promise<TokenPair> {
  return call("POST", "/auth/login", { body: { phone, password } });
}

/** Promotes a user with the backend's script, pointed at the test database. */
export function makeAdmin(phone: string): void {
  assertTestTarget();
  execFileSync(
    resolve(BACKEND_DIR, "venv/Scripts/python.exe"),
    ["-m", "scripts.make_admin", "--phone", phone],
    {
      cwd: BACKEND_DIR,
      env: { ...process.env, DB_NAME: E2E_DB_NAME, DEBUG: "false" },
      stdio: "pipe",
    },
  );
}

export async function deleteAccount(phone: string): Promise<void> {
  try {
    const pair = await loginViaApi(phone);
    await call("DELETE", "/users/me", {
      token: pair.access_token,
      body: { current_password: PASSWORD },
    });
  } catch {
    // already gone
  }
}

type Page<T> = { items: T[] };

/** Deletes every product whose name starts with `prefix` (leftovers of a crashed run). */
export async function deleteProductsByPrefix(
  token: string,
  prefix: string,
): Promise<number> {
  const found = await call<Page<{ id: number; name: string }>>(
    "GET",
    `/admin/products?q=${encodeURIComponent(prefix)}&page_size=100`,
    { token },
  );
  let removed = 0;
  for (const product of found.items.filter((p) => p.name.startsWith(prefix))) {
    try {
      await call("DELETE", `/admin/products/${product.id}`, { token });
      removed += 1;
    } catch {
      // has orders: leave it
    }
  }
  return removed;
}

/** A valid PNG (solid color) built in memory, so no fixture file is needed. */
export function makePng(size = 16): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf)
      c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0xb8)]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Uploads one PNG to a product through the admin API (multipart). */
export async function uploadProductImage(
  token: string,
  productId: number,
): Promise<void> {
  const form = new FormData();
  form.append(
    "files",
    new Blob([new Uint8Array(makePng())], { type: "image/png" }),
    "e2e.png",
  );
  const response = await fetch(`${API}/admin/products/${productId}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) throw new BackendError(response.status, "UPLOAD");
}
