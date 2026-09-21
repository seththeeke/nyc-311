import type { ReactElement } from "react";
import type { QueryTab } from "../../hooks/useQueryTabs";

export interface QueryTabBarProps {
  tabs: QueryTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

/**
 * The query console's tab strip (admin warehouse query-tabs enhancement)
 * — one button per open query, a trailing "+" to open a blank one. Closing
 * the last remaining tab is a no-op (`useQueryTabs.closeTab`'s own rule),
 * so the "×" stays rendered rather than disabled/hidden — clicking it on
 * a lone tab simply does nothing.
 */
export function QueryTabBar({ tabs, activeTabId, onSelect, onClose, onAdd }: QueryTabBarProps): ReactElement {
  return (
    <div role="tablist" aria-label="Open queries" className="flex flex-wrap items-center gap-1 border-b border-line pb-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`group flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-sm ${
              isActive ? "bg-panel-hover text-fg" : "text-fg-subtle hover:bg-panel hover:text-fg"
            }`}
          >
            <button type="button" onClick={() => onSelect(tab.id)} className="max-w-[10rem] truncate">
              {tab.label}
            </button>
            <button
              type="button"
              onClick={() => onClose(tab.id)}
              aria-label={`Close ${tab.label}`}
              className="rounded text-fg-subtle transition-colors hover:text-fg"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        aria-label="New query tab"
        className="ml-1 rounded px-2 py-1 text-fg-subtle transition-transform hover:scale-110 hover:text-fg"
      >
        +
      </button>
    </div>
  );
}
