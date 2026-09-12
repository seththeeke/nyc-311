import type { ReactElement } from "react";
import { MonitoringTile, type MonitoringTileAccent } from "../MonitoringTile";
import { CapacityIcon } from "../monitoring/MonitoringTileIcons";
import { useAuth } from "../../hooks/useAuth";

interface AdminTileConfig {
  title: string;
  description: string;
  to: string;
  accent: MonitoringTileAccent;
  icon: ReactElement;
}

const ADMIN_TILES: AdminTileConfig[] = [
  {
    title: "Capacity",
    description: "Manage the vehicle fleet — add or remove capacity, and see live availability and cost.",
    to: "/admin/capacity",
    accent: "emerald",
    icon: <CapacityIcon />,
  },
];

/**
 * The tile-grid landing page behind `AdminRoute`
 * (`10-capacity-modeling-and-integration.md` §2.2) — same visual pattern
 * as the public `MonitoringPage`, but every tile here is a mutating admin
 * tool, not a read-only report.
 */
export function AdminPage(): ReactElement {
  const { user, signOut } = useAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-emerald-600/30 blur-3xl" />
        <div className="animate-aurora-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-600/30 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <div className="flex items-center justify-between">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Admin &middot; BoroughSim
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>{user.email}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <h1
          className="animate-fade-in-up mt-6 bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Admin
        </h1>
        <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400" style={{ animationDelay: "150ms" }}>
          Management tools — signed in, mutating actions live here.
        </p>

        <div
          className="animate-fade-in-up mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2"
          style={{ animationDelay: "220ms" }}
        >
          {ADMIN_TILES.map((tile) => (
            <MonitoringTile key={tile.to} {...tile} />
          ))}
        </div>
      </div>
    </main>
  );
}
