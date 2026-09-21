import type { ComponentType, ReactElement } from "react";
import { Link } from "react-router-dom";
import type { IconProps } from "../icons";

interface SidebarLinkProps {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}

export const ROW_BASE_CLASSES =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-400";

export function rowStateClasses(active: boolean): string {
  return active ? "bg-blue-600/15 text-fg" : "text-fg-muted hover:bg-panel-hover hover:text-fg";
}

/** A top-level menu link (Map). Collapsed, it's an icon-only rail button whose accessible name is the label. */
export function SidebarLink({ to, label, icon: Icon, active, collapsed, onNavigate }: SidebarLinkProps): ReactElement {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`${ROW_BASE_CLASSES} ${rowStateClasses(active)} ${collapsed ? "justify-center px-0" : ""}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
