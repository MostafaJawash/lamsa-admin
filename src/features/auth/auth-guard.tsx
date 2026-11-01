import { Navigate, Outlet } from "react-router";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/session";
import { m } from "@/messages";

import { useSession } from "./use-session";

/**
 * Wraps every admin route. Reactive: if the session ends while the dashboard is open
 * (refresh failed, logout), the user is sent to /login. The router loader
 * (`requireAdmin`) covers the first navigation; this covers everything after it.
 */
export function AuthGuard() {
  const session = useSession();
  if (session.status !== "authenticated" || session.user.role !== "admin") {
    return <Navigate to="/login" replace />;
  }
  if (session.user.must_change_password) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState title={m.auth.logout} message={m.auth.mustChangePassword}>
          <Button variant="outline" onClick={() => void logout()}>
            {m.auth.logout}
          </Button>
        </ErrorState>
      </div>
    );
  }
  return <Outlet />;
}
