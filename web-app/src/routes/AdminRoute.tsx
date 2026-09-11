import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface AdminRouteProps {
  children: ReactElement;
}

/*
 * Authenticated-admin visibility tier (CLAUDE.md §5.1,
 * `9-admin-auth-integration.md` §3) — the second access guard alongside
 * PublicRoute. Every admin page routes through here rather than an ad-hoc
 * check per page. Redirects to /login (preserving the attempted path in
 * location state) when logged out; renders nothing while the initial
 * session check is still loading, to avoid a flash of the login page for
 * an already-authenticated admin.
 */
export function AdminRoute({ children }: AdminRouteProps): ReactElement | null {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
