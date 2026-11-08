import { NavLink, Outlet } from "react-router-dom";
import { useServerHealth } from "../hooks/queries.ts";
import { FindingList } from "./FindingList.tsx";

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "text-slate-100" : "text-slate-400 hover:text-slate-200");

/** Header, nav, machine-wide findings, then the page. */
export function Layout() {
  const { data: health } = useServerHealth();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">Agent Monitor</h1>
        <nav aria-label="Main" className="flex gap-4 text-sm">
          <NavLink to="/" end className={linkClass}>Agents</NavLink>
          <NavLink to="/worktrees" className={linkClass}>Worktrees</NavLink>
        </nav>
      </header>
      {health && health.findings.length > 0 && (
        <section aria-label="Machine findings" className="rounded border border-amber-500/40 bg-amber-500/10 p-3">
          <FindingList findings={health.findings} />
        </section>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
