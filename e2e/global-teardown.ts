import {
  deleteAccount,
  deleteProductsByPrefix,
  loginViaApi,
} from "./support/backend.ts";

export default async function globalTeardown() {
  const phone = process.env.E2E_ADMIN_PHONE;
  if (!phone) return;
  try {
    const admin = await loginViaApi(phone);
    await deleteProductsByPrefix(admin.access_token, "e2e-");
  } catch {
    // nothing to sweep
  }
  await deleteAccount(phone);
}
