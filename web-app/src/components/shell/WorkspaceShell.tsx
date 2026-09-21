import type { ReactElement, ReactNode } from "react";
import { useShellLayout } from "../../hooks/useShellLayout";
import { SecondaryWorkspace } from "./SecondaryWorkspace";
import { Sidebar } from "./Sidebar";
import { TooltipLayer } from "./TooltipLayer";
import { MenuIcon, SecondaryToggleIcon } from "./shellIcons";

interface WorkspaceShellProps {
  children: ReactNode;
}

const FLOATING_BUTTON_CLASSES =
  "fixed z-[1400] rounded-full border border-line bg-popover p-2 text-fg-muted shadow-lg hover:text-fg";

/**
 * The persistent 3-panel frame: menu drawer (left), primary workspace
 * (`children`, the routed page), secondary workspace (right). Owns the
 * viewport — no page-level scroll; the primary and secondary panels scroll
 * independently. Below 768px the menu becomes an overlay drawer opened from
 * a hamburger.
 */
export function WorkspaceShell({ children }: WorkspaceShellProps): ReactElement {
  const layout = useShellLayout();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-surface text-fg">
      <TooltipLayer />
      {layout.isOverlay ? (
        <>
          {layout.overlayOpen && (
            <div className="fixed inset-0 z-[1500] flex">
              <Sidebar
                collapsed={false}
                onToggleCollapse={layout.toggleSidebar}
                onExpand={layout.expandSidebar}
                onNavigate={layout.closeOverlay}
              />
              <button
                type="button"
                aria-label="Close menu"
                onClick={layout.closeOverlay}
                className="flex-1 bg-scrim"
              />
            </div>
          )}
          {!layout.overlayOpen && (
            <button
              type="button"
              onClick={layout.toggleSidebar}
              aria-label="Open menu"
              className={`${FLOATING_BUTTON_CLASSES} bottom-4 left-4`}
            >
              <MenuIcon />
            </button>
          )}
        </>
      ) : (
        <Sidebar
          collapsed={layout.sidebarCollapsed}
          onToggleCollapse={layout.toggleSidebar}
          onExpand={layout.expandSidebar}
          onNavigate={layout.closeOverlay}
        />
      )}

      <div role="region" aria-label="Primary workspace" className="h-full min-w-0 flex-1 overflow-y-auto">
        {children}
      </div>

      {layout.rightCollapsed ? (
        <button
          type="button"
          onClick={layout.toggleRight}
          aria-label="Show secondary panel"
          className={`${FLOATING_BUTTON_CLASSES} top-3 right-3`}
        >
          <SecondaryToggleIcon />
        </button>
      ) : (
        <SecondaryWorkspace onCollapse={layout.toggleRight} />
      )}
    </div>
  );
}
