import { useCallback, useState, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { AboutOverlay } from "../about/AboutOverlay";
import { ROW_BASE_CLASSES, rowStateClasses } from "./SidebarLink";
import { InfoIcon, SignOutIcon } from "./shellIcons";
import { ThemeToggle } from "./ThemeToggle";

interface SidebarFooterProps {
  collapsed: boolean;
}

const ABOUT_PATH = "/about";

/**
 * Everything the old top `Header` carried besides navigation: the About
 * drawer (the button toggles it in place — click again or use Close; visiting `/about` — Map renders
 * underneath — opens the same drawer, and closing returns to `/`), the theme
 * toggle, and the signed-in admin's email + Sign out.
 */
export function SidebarFooter({ collapsed }: SidebarFooterProps): ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [aboutButtonOpen, setAboutButtonOpen] = useState(false);
  const aboutRouteActive = pathname === ABOUT_PATH;

  const aboutOpen = aboutButtonOpen || aboutRouteActive;

  const closeAbout = useCallback(() => {
    setAboutButtonOpen(false);
    if (aboutRouteActive) navigate("/", { replace: true });
  }, [aboutRouteActive, navigate]);

  const layout = collapsed ? "justify-center px-0" : "";

  return (
    <div className="space-y-1 border-t border-line pt-3">
      <div className={`flex ${collapsed ? "flex-col items-center gap-1" : "items-center gap-2"}`}>
        <button
          type="button"
          onClick={() => (aboutOpen ? closeAbout() : setAboutButtonOpen(true))}
          aria-label="About"
          aria-expanded={aboutOpen}
          className={`${ROW_BASE_CLASSES} ${rowStateClasses(false)} ${layout} ${collapsed ? "" : "min-w-0 flex-1"}`}
        >
          <InfoIcon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>About</span>}
        </button>
        <ThemeToggle collapsed={collapsed} />
      </div>
      {user && (
        <div className={`flex items-center gap-2 pt-1 ${collapsed ? "justify-center" : "px-3"}`}>
          {!collapsed && <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle">{user.email}</span>}
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-fg-muted hover:bg-panel-hover hover:text-fg"
          >
            <SignOutIcon className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      )}
      {aboutOpen && <AboutOverlay onClose={closeAbout} />}
    </div>
  );
}
