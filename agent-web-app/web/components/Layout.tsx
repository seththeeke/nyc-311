import { NavLink, Outlet } from "react-router-dom";
import { useServerHealth } from "../hooks/queries.ts";
import { FindingList } from "./FindingList.tsx";

const VIEWS = [
  { to: "/", label: "Dashboard", glyph: "▤", end: true },
  { to: "/office", label: "Pixel Office", glyph: "▣", end: false },
  { to: "/worktrees", label: "Worktrees", glyph: "⑂", end: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded px-3 py-2 text-sm ${isActive ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`;

/** The shell: a left sidebar to switch views (a top bar on narrow screens), machine-wide findings, then the page. */
export function Layout() {
  const { data: health } = useServerHealth();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-800 bg-slate-950 md:sticky md:top-0 md:h-screen md:w-52 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:block">
          <h1 className="text-lg font-semibold">Agent Monitor</h1>
          <p className="hidden text-xs text-slate-500 md:mt-1 md:block">localhost · read-only</p>
        </div>
        <nav aria-label="Views" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {VIEWS.map((view) => (
            <NavLink key={view.to} to={view.to} end={view.end} className={linkClass}>
              <span aria-hidden="true" className="w-4 text-center">{view.glyph}</span>
              {view.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 space-y-6 px-4 py-6 md:px-8">
        {health && health.findings.length > 0 && (
          <section aria-label="Machine findings" className="rounded border border-amber-500/40 bg-amber-500/10 p-3">
            <FindingList findings={health.findings} />
          </section>
        )}
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
