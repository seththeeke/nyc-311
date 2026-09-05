import type { ReactElement } from "react";

export const DATA_VIEWS = ["jobs", "performance"] as const;
export type DataView = (typeof DATA_VIEWS)[number];

export interface DataViewTabsProps {
  view: DataView;
  onChange: (view: DataView) => void;
}

const OPTIONS: { value: DataView; label: string }[] = [
  { value: "jobs", label: "Jobs" },
  { value: "performance", label: "Performance" },
];

export function dataViewTabId(view: DataView): string {
  return `data-view-tab-${view}`;
}

export function dataViewPanelId(view: DataView): string {
  return `data-view-panel-${view}`;
}

/*
 * AWS-console-style tab strip (CloudFormation's stack detail tabs): a
 * full-width bottom rule, a thin vertical divider between each option,
 * and a short accent underline under the active tab — sits directly on
 * top of the panel it controls (7-data-warehousing.md §12).
 */
export function DataViewTabs({ view, onChange }: DataViewTabsProps): ReactElement {
  return (
    <div role="tablist" aria-label="Warehouse view" className="flex border-b border-slate-200 px-1 text-sm">
      {OPTIONS.map((option, index) => {
        const isActive = option.value === view;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={dataViewTabId(option.value)}
            aria-selected={isActive}
            aria-controls={dataViewPanelId(option.value)}
            onClick={() => onChange(option.value)}
            className={`relative px-3 py-2.5 font-medium transition-colors ${
              index > 0 ? "border-l border-slate-200" : ""
            } ${
              isActive
                ? "text-slate-900 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-cyan-500"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
