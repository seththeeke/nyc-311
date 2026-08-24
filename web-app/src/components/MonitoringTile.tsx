import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export type MonitoringTileAccent = "cyan" | "violet" | "emerald" | "amber" | "rose" | "indigo";

export interface MonitoringTileProps {
  title: string;
  description: string;
  to: string;
  accent?: MonitoringTileAccent;
  icon?: ReactElement;
  /** When true, `to` is an external/hosted URL — opens in a new tab as a plain anchor instead of a React Router `Link`. */
  external?: boolean;
}

/*
 * Literal class strings (not built from `${accent}` template interpolation)
 * so Tailwind's static scanner can actually see and emit them.
 */
const ACCENT_STYLES: Record<MonitoringTileAccent, { glow: string; badge: string; link: string; shadow: string }> = {
  cyan: {
    glow: "bg-cyan-500/20",
    badge: "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/30",
    link: "text-cyan-300",
    shadow: "hover:shadow-cyan-500/10",
  },
  violet: {
    glow: "bg-violet-500/20",
    badge: "bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/30",
    link: "text-violet-300",
    shadow: "hover:shadow-violet-500/10",
  },
  emerald: {
    glow: "bg-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30",
    link: "text-emerald-300",
    shadow: "hover:shadow-emerald-500/10",
  },
  amber: {
    glow: "bg-amber-500/20",
    badge: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/30",
    link: "text-amber-300",
    shadow: "hover:shadow-amber-500/10",
  },
  rose: {
    glow: "bg-rose-500/20",
    badge: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30",
    link: "text-rose-300",
    shadow: "hover:shadow-rose-500/10",
  },
  indigo: {
    glow: "bg-indigo-500/20",
    badge: "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/30",
    link: "text-indigo-300",
    shadow: "hover:shadow-indigo-500/10",
  },
};

export function MonitoringTile({
  title,
  description,
  to,
  accent = "cyan",
  icon,
  external = false,
}: MonitoringTileProps): ReactElement {
  const styles = ACCENT_STYLES[accent];

  const content = (
    <>
      <div
        aria-hidden="true"
        className={`absolute -top-10 -right-10 h-36 w-36 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${styles.glow}`}
      />
      <div className="relative">
        {icon && (
          <div aria-hidden="true" className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${styles.badge}`}>
            {icon}
          </div>
        )}
        <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-400">{description}</p>
        <span
          className={`mt-4 flex items-center gap-1 text-sm font-medium opacity-0 transition-all duration-300 group-hover:gap-2 group-hover:opacity-100 ${styles.link}`}
        >
          Open
          <span aria-hidden="true">&rarr;</span>
        </span>
      </div>
    </>
  );

  const className = `group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-2xl ${styles.shadow}`;

  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}
