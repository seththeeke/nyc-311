import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { applySuggestion, getCurrentWordRange, getSuggestions, type WordRange } from "./sqlAutocomplete";
import type { WarehouseTable } from "../../models/warehouseSchema";

export interface UseSqlAutocompleteResult {
  suggestions: string[];
  activeIndex: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Call from the textarea's onChange with the new value and its current cursor position. */
  handleTextChange: (value: string, cursor: number) => void;
  /** Call from the textarea's onKeyDown — navigates/selects the menu when it's open, otherwise a no-op. */
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Applies a suggestion (from a click or keyboard selection) and closes the menu. */
  handleSelect: (suggestion: string) => void;
}

/**
 * The stateful half of `SqlQueryConsole`'s schema-aware typeahead —
 * tracks the open suggestion list/active index and applies a selection
 * back into the textarea, including moving the caret afterward (deferred
 * to a `useEffect` keyed on the text itself, since setting
 * `selectionStart` right after `setSql` would still act on the
 * textarea's pre-update DOM value). Kept out of `SqlQueryConsole.tsx` so
 * that component stays focused on rendering.
 */
export function useSqlAutocomplete(
  sql: string,
  setSql: (value: string) => void,
  tables: WarehouseTable[]
): UseSqlAutocompleteResult {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [wordRange, setWordRange] = useState<WordRange | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCursorRef.current === null || !textareaRef.current) return;
    textareaRef.current.selectionStart = pendingCursorRef.current;
    textareaRef.current.selectionEnd = pendingCursorRef.current;
    textareaRef.current.focus();
    pendingCursorRef.current = null;
  }, [sql]);

  function handleTextChange(value: string, cursor: number): void {
    const nextSuggestions = getSuggestions(value, cursor, tables);
    if (nextSuggestions.length === 0) {
      setSuggestions([]);
      setWordRange(null);
      return;
    }
    setSuggestions(nextSuggestions);
    setWordRange(getCurrentWordRange(value, cursor));
    setActiveIndex(0);
  }

  function handleSelect(suggestion: string): void {
    if (!wordRange) return;
    const result = applySuggestion(sql, wordRange, suggestion);
    pendingCursorRef.current = result.cursor;
    setSql(result.text);
    setSuggestions([]);
    setWordRange(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSuggestions([]);
      setWordRange(null);
    }
  }

  return { suggestions, activeIndex, textareaRef, handleTextChange, handleKeyDown, handleSelect };
}
