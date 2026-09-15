import type { WarehouseTable } from "../../models/warehouseSchema";

/*
 * A basic, schema-aware typeahead for the ad-hoc SQL textarea — plain
 * JavaScript over the raw text, no code-editor library (CLAUDE.md §5.1
 * has no dependency for this; a lightweight hand-rolled dropdown was the
 * deliberate choice over pulling in something like CodeMirror). Suggests
 * SQL keywords plus every table/column name from the live warehouse
 * schema, so a query can be written without leaving the console to check
 * a column's exact spelling.
 */
export const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "JOIN",
  "LEFT JOIN",
  "INNER JOIN",
  "ON",
  "AND",
  "OR",
  "NOT",
  "AS",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "IS NULL",
  "IS NOT NULL",
  "IN",
  "BETWEEN",
  "LIKE",
  "DESC",
  "ASC",
  "WITH",
] as const;

/** Word characters a table/column identifier or keyword fragment can be made of. */
const WORD_CHAR_PATTERN = /[\w.]/;

export interface WordRange {
  start: number;
  end: number;
  word: string;
}

/**
 * The identifier fragment immediately before `cursor` — walks backward
 * from the cursor while characters are word-like, per `WORD_CHAR_PATTERN`.
 * An empty `word` means the cursor sits right after whitespace/punctuation
 * (nothing to suggest against yet).
 */
export function getCurrentWordRange(text: string, cursor: number): WordRange {
  let start = cursor;
  while (start > 0 && WORD_CHAR_PATTERN.test(text[start - 1])) start -= 1;
  return { start, end: cursor, word: text.slice(start, cursor) };
}

/** Every unique table and column name in the schema, in schema order (tables first, then each table's own columns). */
function schemaIdentifiers(tables: WarehouseTable[]): string[] {
  const seen = new Set<string>();
  const identifiers: string[] = [];
  for (const table of tables) {
    if (!seen.has(table.table_name)) {
      seen.add(table.table_name);
      identifiers.push(table.table_name);
    }
    for (const column of table.columns) {
      if (!seen.has(column.name)) {
        seen.add(column.name);
        identifiers.push(column.name);
      }
    }
  }
  return identifiers;
}

const MAX_SUGGESTIONS = 8;

/**
 * Suggestions for the word at `cursor`, schema identifiers first (the
 * more specific match, per the admin warehouse redesign's "schema-aware"
 * ask) then keywords — prefix-matched case-insensitively, capped at
 * {@link MAX_SUGGESTIONS}. Returns `[]` when there's nothing typed yet to
 * match against, so the menu doesn't pop up on every keystroke.
 */
export function getSuggestions(text: string, cursor: number, tables: WarehouseTable[]): string[] {
  const { word } = getCurrentWordRange(text, cursor);
  if (word.trim() === "") return [];

  const lowerWord = word.toLowerCase();
  const matches = (candidate: string) => candidate.toLowerCase().startsWith(lowerWord) && candidate.toLowerCase() !== lowerWord;

  const identifierMatches = schemaIdentifiers(tables).filter(matches);
  const keywordMatches = SQL_KEYWORDS.filter(matches);

  return [...identifierMatches, ...keywordMatches].slice(0, MAX_SUGGESTIONS);
}

/** Replaces the word at `range` with `suggestion` plus a trailing space, and returns where the cursor lands next. */
export function applySuggestion(text: string, range: WordRange, suggestion: string): { text: string; cursor: number } {
  const insertion = `${suggestion} `;
  const nextText = text.slice(0, range.start) + insertion + text.slice(range.end);
  return { text: nextText, cursor: range.start + insertion.length };
}
