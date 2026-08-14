import type { ReactElement } from "react";

interface PublicRouteProps {
  children: ReactElement;
}

// Public-dashboard visibility tier: no auth check today, but every public
// page routes through here (not ad-hoc per-page checks) so a future gate
// (e.g. rate limiting, feature flag) has one place to land.
export function PublicRoute({ children }: PublicRouteProps): ReactElement {
  return children;
}
