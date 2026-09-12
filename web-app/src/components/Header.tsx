import type { ReactElement } from "react";
import { Link } from "react-router-dom";

/**
 * Global top banner (every route renders it, wired once in App.tsx) — the
 * app title on the left, System Monitoring and Admin on the right. Admin
 * links straight to `/admin`; `AdminRoute` already redirects an unauthenticated
 * visitor to `/login` (preserving `/admin` as the post-login destination), so
 * the login-then-admin handoff needs no logic here.
 */
export function Header(): ReactElement {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="text-lg font-bold tracking-tight text-white">
          BoroughSim
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-3">
          <Link
            to="/monitoring"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/10"
          >
            System Monitoring
          </Link>
          <Link
            to="/admin"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/10"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
