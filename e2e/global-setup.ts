import {
  assertTestTarget,
  backendUp,
  makeAdmin,
  PASSWORD,
  registerViaApi,
  uniquePhone,
} from "./support/backend.ts";

/**
 * A test admin, as in lamsa-web: registered through the API, promoted with the backend's
 * scripts.make_admin (on lamsa_test), deleted in global-teardown.ts. Workers read it from
 * the environment. Without a backend, the product tests skip themselves.
 */
export default async function globalSetup() {
  assertTestTarget();
  if (!(await backendUp())) return;
  const phone = uniquePhone();
  await registerViaApi(`e2e-admin-${Date.now()}`, phone);
  makeAdmin(phone);
  process.env.E2E_ADMIN_PHONE = phone;
  process.env.E2E_ADMIN_PASSWORD = PASSWORD;
}
