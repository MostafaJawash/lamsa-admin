import {
  deleteAccount,
  deleteCatalogByPrefix,
  deleteProductsByPrefix,
  loginViaApi,
} from "./support/backend.ts";
import { cleanupRecorded } from "./support/orders.ts";

export default async function globalTeardown() {
  const phone = process.env.E2E_ADMIN_PHONE;
  if (!phone) return;
  try {
    const admin = await loginViaApi(phone);
    // Orders first (SQL on lamsa_test), then customers/products/categories through the API.
    await cleanupRecorded(admin.access_token);
    await deleteProductsByPrefix(admin.access_token, "e2e-");
    await deleteCatalogByPrefix(admin.access_token, "e2e-");
  } catch {
    // nothing to sweep
  }
  await deleteAccount(phone);
}
