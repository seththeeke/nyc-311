import type { ReactElement } from "react";

export interface SqlAutocompleteMenuProps {
  suggestions: string[];
  activeIndex: number;
  onSelect: (suggestion: string) => void;
}

/**
 * The suggestion dropdown for `SqlQueryConsole`'s schema-aware typeahead
 * — a plain list under the textarea (not positioned at the exact caret
 * pixel, which a bare `<textarea>` has no native way to measure; "basic"
 * was the deliberate call here over pulling in a code-editor library).
 * Mouse and keyboard selection both call `onSelect` the same way.
 */
export function SqlAutocompleteMenu({ suggestions, activeIndex, onSelect }: SqlAutocompleteMenuProps): ReactElement {
  return (
    <ul
      role="listbox"
      aria-label="SQL suggestions"
      className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-slate-900 text-sm shadow-xl"
    >
      {suggestions.map((suggestion, index) => (
        <li key={suggestion}>
          <button
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            /* Mousedown, not click — fires before the textarea's blur, so the selection lands before focus (and the menu) would otherwise be lost. */
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(suggestion);
            }}
            className={`block w-full px-3 py-1.5 text-left font-mono ${
              index === activeIndex ? "bg-cyan-600 text-white" : "text-slate-200 hover:bg-white/10"
            }`}
          >
            {suggestion}
          </button>
        </li>
      ))}
    </ul>
  );
}
