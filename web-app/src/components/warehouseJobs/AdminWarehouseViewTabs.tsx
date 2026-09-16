import type { ReactElement } from "react";

export const ADMIN_WAREHOUSE_VIEWS = ["workspace", "reports"] as const;
export type AdminWarehouseView = (typeof ADMIN_WAREHOUSE_VIEWS)[number];

export interface AdminWarehouseViewTabsProps {
  view: AdminWarehouseView;
  onChange: (view: AdminWarehouseView) => void;
}

const OPTIONS: { value: AdminWarehouseView; label: string }[] = [
  { value: "workspace", label: "Workspace" },
  { value: "reports", label: "Reports" },
];

export function adminWarehouseViewTabId(view: AdminWarehouseView): string {
  return `admin-warehouse-view-tab-${view}`;
}

export function adminWarehouseViewPanelId(view: AdminWarehouseView): string {
  return `admin-warehouse-view-panel-${view}`;
}

/*
 * Same underline-tab visual pattern as components/data/DataViewTabs.tsx,
 * adapted to this page's dark theme (that component is light-themed and
 * coupled to the public Data page's own three tabs) — a page-level
 * "Workspace"/"Reports" switch for AdminWarehousePage
 * (7-data-warehousing.md §12b's Reports tab addition).
 */
export function AdminWarehouseViewTabs({ view, onChange }: AdminWarehouseViewTabsProps): ReactElement {
  return (
    <div role="tablist" aria-label="Admin warehouse view" className="flex border-b border-white/10 px-1 text-sm">
      {OPTIONS.map((option, index) => {
        const isActive = option.value === view;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={adminWarehouseViewTabId(option.value)}
            aria-selected={isActive}
            aria-controls={adminWarehouseViewPanelId(option.value)}
            onClick={() => onChange(option.value)}
            className={`relative px-3 py-2.5 font-medium transition-colors ${
              index > 0 ? "border-l border-white/10" : ""
            } ${
              isActive
                ? "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
