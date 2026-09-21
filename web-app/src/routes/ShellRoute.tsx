import type { ReactElement } from "react";
import { Outlet } from "react-router-dom";
import { WorkspaceProvider } from "../components/shell/WorkspaceProvider";
import { WorkspaceShell } from "../components/shell/WorkspaceShell";

/*
 * Layout route wrapping every page (12-UX-workspace-refactor.md §3.1): the
 * 3-panel shell persists across navigation while the routed page renders in
 * the primary workspace. Access guards (PublicRoute/AdminRoute) stay on the
 * individual routes inside it.
 */
export function ShellRoute(): ReactElement {
  return (
    <WorkspaceProvider>
      <WorkspaceShell>
        <Outlet />
      </WorkspaceShell>
    </WorkspaceProvider>
  );
}
