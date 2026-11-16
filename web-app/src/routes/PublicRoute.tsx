import type { ReactElement } from "react";

interface PublicRouteProps {
  children: ReactElement;
}

/*
 * Public-dashboard visibility tier: no auth check today, but every public
 * page routes through here (not ad-hoc per-page checks) so a future gate
 * (e.g. rate limiting) has one place to land. AppRoutes wraps every
 * `PUBLIC` row of pageTable.ts in it, flagged pages included.
 */
export function PublicRoute({ children }: PublicRouteProps): ReactElement {
  return children;
}
