import { useCallback, useState, type ReactElement } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AboutOverlay } from "./about/AboutOverlay";

const NAV_PILL_CLASSES =
  "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/10";

const ABOUT_PATH = "/about";

/**
 * Global top banner (wired once in App.tsx) — app title left; About, System
 * Monitoring and Admin right. About is a button that opens a drawer over the
 * current page without navigating; visiting `/about` (a shareable link, Home
 * renders underneath) opens the same drawer, and closing it returns to `/`.
 * Admin links straight to `/admin`; `AdminRoute` handles the login redirect.
 */
export function Header(): ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [aboutButtonOpen, setAboutButtonOpen] = useState(false);
  const aboutRouteActive = pathname === ABOUT_PATH;
  const aboutOpen = aboutRouteActive || aboutButtonOpen;

  const closeAbout = useCallback(() => {
    setAboutButtonOpen(false);
    if (aboutRouteActive) navigate("/", { replace: true });
  }, [aboutRouteActive, navigate]);

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="text-lg font-bold tracking-tight text-white">
          BoroughSim
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-3">
          <button type="button" onClick={() => setAboutButtonOpen(true)} className={NAV_PILL_CLASSES}>
            About
          </button>
          <Link to="/monitoring" className={NAV_PILL_CLASSES}>
            System Monitoring
          </Link>
          <Link to="/admin" className={NAV_PILL_CLASSES}>
            Admin
          </Link>
        </nav>
      </div>
      {aboutOpen && <AboutOverlay onClose={closeAbout} />}
    </header>
  );
}
