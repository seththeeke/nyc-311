import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/auth";

function NavPill({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
          isActive ? "bg-white text-[var(--color-ink)]" : "text-white/85 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function Layout() {
  const { isAdmin, user } = useAuth();

  return (
    <div className="min-h-svh bg-[var(--color-paper)]">
      <header className="pointer-events-none fixed inset-x-0 top-4 z-[1000] flex justify-center px-4">
        <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-1.5 shadow-lg backdrop-blur-md">
          <div className="ml-1 mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-xs font-bold text-white">
            C
          </div>
          <NavPill to="/">Home</NavPill>
          <NavPill to="/about">About This</NavPill>
        </nav>
      </header>

      <Outlet />

      <Link
        to="/login"
        aria-label={isAdmin ? `Signed in as ${user?.display_name}` : "Login"}
        title={isAdmin ? `Signed in as ${user?.display_name}` : "Login"}
        className={`fixed bottom-8 right-4 z-[1000] flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-colors ${
          isAdmin
            ? "border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/25 text-white"
            : "border-white/10 bg-black/25 text-white/35 hover:bg-black/40 hover:text-white/80"
        }`}
      >
        <LockIcon />
      </Link>
    </div>
  );
}
