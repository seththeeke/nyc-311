import type { ReactElement } from "react";

export type StageLayout = "vertical" | "horizontal";

export interface StageLayoutToggleProps {
  layout: StageLayout;
  onChange: (layout: StageLayout) => void;
}

const OPTIONS: { value: StageLayout; label: string }[] = [
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
];

export function StageLayoutToggle({ layout, onChange }: StageLayoutToggleProps): ReactElement {
  return (
    <div
      role="group"
      aria-label="Stage layout"
      className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs"
    >
      {OPTIONS.map((option) => {
        const isActive = option.value === layout;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
