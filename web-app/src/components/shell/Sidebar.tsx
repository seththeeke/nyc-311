import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarMenu } from "./SidebarMenu";
import { MapMarkerIcon, SidebarToggleIcon } from "./shellIcons";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onExpand: () => void;
  onNavigate: () => void;
}

/**
 * The left menu drawer: brand + collapse button, the three-entry menu, and
 * the footer controls. Collapsed, it's a 64px icon rail; every icon-only
 * control keeps an `aria-label` (CLAUDE.md §5.1).
 */
export function Sidebar({ collapsed, onToggleCollapse, onExpand, onNavigate }: SidebarProps): ReactElement {
  return (
    <aside
      aria-label="Menu"
      className={`flex h-full shrink-0 flex-col gap-4 border-r border-line bg-panel-sunken p-3 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
        <Link
          to="/"
          onClick={onNavigate}
          aria-label="BoroughSim"
          className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-xl font-bold tracking-tight text-fg"
        >
          <MapMarkerIcon className="h-10 w-10 shrink-0 text-hue-cyan" />
          {!collapsed && <span className="truncate">BoroughSim</span>}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          aria-expanded={!collapsed}
          className="rounded-lg p-1.5 text-fg-subtle hover:bg-panel-hover hover:text-fg"
        >
          <SidebarToggleIcon />
        </button>
      </div>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto">
        <SidebarMenu collapsed={collapsed} onExpand={onExpand} onNavigate={onNavigate} />
      </nav>
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}
