import type { ReactElement, ReactNode } from "react";

export interface CollapsiblePanelProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Width (and any other layout) classes applied only while expanded — collapsed always renders as a slim fixed-width strip. */
  expandedClassName?: string;
}

/**
 * A side panel that collapses to a slim strip showing only its toggle
 * button — used by `AdminWarehousePage` for the Schema and Jobs panels
 * flanking the query editor (`7-data-warehousing.md` §12b), so either
 * can be tucked away to give the editor more room without navigating
 * away from it.
 */
export function CollapsiblePanel({
  title,
  collapsed,
  onToggle,
  children,
  expandedClassName = "w-72",
}: CollapsiblePanelProps): ReactElement {
  return (
    <div
      className={`flex shrink-0 flex-col rounded-2xl border border-white/10 bg-slate-950 ${collapsed ? "w-12" : expandedClassName}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-2">
        {!collapsed && <h2 className="truncate px-1 text-sm font-semibold text-white">{title}</h2>}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Show ${title}` : `Hide ${title}`}
          className="ml-auto shrink-0 rounded p-1.5 text-slate-300 hover:bg-white/10"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      {!collapsed && <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>}
    </div>
  );
}
