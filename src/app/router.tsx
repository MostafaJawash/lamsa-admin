import { createBrowserRouter, redirect } from "react-router";

import { AppShell } from "@/components/layout";
import { AuthGuard } from "@/features/auth";
import { isAdminSession } from "@/lib/auth/session";
import { BannersPage } from "@/pages/banners";
import { BrandsPage } from "@/pages/brands";
import { CategoriesPage } from "@/pages/categories";
import { CustomersPage } from "@/pages/customers";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { NotFoundPage } from "@/pages/not-found";
import { NotificationsPage } from "@/pages/notifications";
import { OrdersPage } from "@/pages/orders";
import { ProductsPage } from "@/pages/products";
import { SettingsPage } from "@/pages/settings";

/** Loader of the protected tree: no admin session means /login before anything renders. */
function requireAdmin() {
  if (!isAdminSession()) throw redirect("/login");
  return null;
}

/** An admin who opens /login while signed in goes straight to the dashboard. */
function redirectIfSignedIn() {
  if (isAdminSession()) throw redirect("/");
  return null;
}

/**
 * Route tree. Everything except /login sits under the loader (first navigation) and
 * <AuthGuard> (session ending while the app is open).
 */
export const router = createBrowserRouter([
  { path: "/login", loader: redirectIfSignedIn, element: <LoginPage /> },
  {
    loader: requireAdmin,
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "products", element: <ProductsPage /> },
          { path: "categories", element: <CategoriesPage /> },
          { path: "brands", element: <BrandsPage /> },
          { path: "orders", element: <OrdersPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "banners", element: <BannersPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
