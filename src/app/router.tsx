import { createBrowserRouter, redirect } from "react-router";

import { AppShell } from "@/components/layout";
import { AuthGuard } from "@/features/auth";
import { isAdminSession } from "@/lib/auth/session";
import { BannersPage } from "@/pages/banners";
import { BrandsPage } from "@/pages/brands";
import { CategoriesPage } from "@/pages/categories";
import {
  CategoryCreatePage,
  CategoryEditPage,
} from "@/pages/categories/category-form-page";
import { CustomersPage } from "@/pages/customers";
import { CustomerDetailPage } from "@/pages/customers/customer-detail-page";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { NotFoundPage } from "@/pages/not-found";
import { NotificationsPage } from "@/pages/notifications";
import { OrdersPage } from "@/pages/orders";
import { OrderDetailPage } from "@/pages/orders/order-detail-page";
import { ProductsPage } from "@/pages/products";
import {
  ProductCreatePage,
  ProductEditPage,
} from "@/pages/products/product-form-page";
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
          { path: "products/new", element: <ProductCreatePage /> },
          { path: "products/:id/edit", element: <ProductEditPage /> },
          { path: "categories", element: <CategoriesPage /> },
          { path: "categories/new", element: <CategoryCreatePage /> },
          { path: "categories/:id/edit", element: <CategoryEditPage /> },
          { path: "brands", element: <BrandsPage /> },
          { path: "orders", element: <OrdersPage /> },
          { path: "orders/:id", element: <OrderDetailPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "customers/:id", element: <CustomerDetailPage /> },
          { path: "banners", element: <BannersPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
